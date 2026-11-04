import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
describe('Marcadores (e2e)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    usuarios: UsuariosTeste,
    plantaId: string,
    outraPlanta: string,
    lotes: string[],
    loteamentoId: string;
  beforeEach(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
    const p = await prisma.planta.create({
      data: {
        nome: 'Planta',
        versao: 1,
        status: 'PRONTA',
        criadoPorId: usuarios.ADMINISTRADOR.id,
      },
    });
    plantaId = p.id;
    outraPlanta = (
      await prisma.planta.create({
        data: {
          nome: 'Outra',
          versao: 2,
          status: 'PRONTA',
          criadoPorId: usuarios.ADMINISTRADOR.id,
        },
      })
    ).id;
    const e = await prisma.loteamento.create({ data: { nome: 'Teste' } });
    loteamentoId = e.id;
    const q = await prisma.quadra.create({
      data: { loteamentoId: e.id, numero: '1' },
    });
    lotes = [];
    for (let i = 1; i <= 3; i++)
      lotes.push(
        (
          await prisma.lote.create({
            data: { quadraId: q.id, numero: String(i), areaM2: 100 },
          })
        ).id,
      );
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });
  const url = () => `/v1/plantas/${plantaId}`;
  const api = () => request(app.getHttpServer());
  const token = () => usuarios.GESTOR.token;
  const create = (loteId = lotes[0]) =>
    api()
      .post(url() + '/marcadores')
      .auth(token(), { type: 'bearer' })
      .send({ loteId, x: 0, y: 1 });
  it('CRUD com paginação, limites, lista sem marcador e auditoria', async () => {
    const antes = await api()
      .get(url() + '/lotes-sem-marcador?loteamentoId=' + loteamentoId)
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(antes.body.meta.total).toBe(3);
    const m = (await create().expect(201)).body;
    const list = await api()
      .get(url() + '/marcadores?pageSize=1')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(list.body.data[0].id).toBe(m.id);
    expect(
      (
        await api()
          .get(url() + '/lotes-sem-marcador')
          .auth(token(), { type: 'bearer' })
          .expect(200)
      ).body.meta.total,
    ).toBe(2);
    await api()
      .patch(url() + '/marcadores/' + m.id)
      .auth(token(), { type: 'bearer' })
      .send({ x: 1, y: 0 })
      .expect(200);
    await api()
      .delete(url() + '/marcadores/' + m.id)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(
      (
        await api()
          .get(url() + '/lotes-sem-marcador')
          .auth(token(), { type: 'bearer' })
          .expect(200)
      ).body.meta.total,
    ).toBe(3);
    expect(
      (
        await prisma.historicoAuditoria.findMany({
          where: { entidadeId: m.id },
        })
      )
        .map((a) => a.acao)
        .sort(),
    ).toEqual(['CRIAR', 'EXCLUIR', 'MOVER']);
  });
  it('rejeita coordenadas inválidas e campos indevidos', async () => {
    for (const body of [
      { loteId: lotes[0], x: -0.1, y: 0 },
      { loteId: lotes[0], x: 0, y: 1.1 },
      { loteId: lotes[0], x: null, y: 0 },
      { loteId: lotes[0], x: '0', y: 0 },
    ])
      await api()
        .post(url() + '/marcadores')
        .auth(token(), { type: 'bearer' })
        .send(body)
        .expect(400);
  });
  it('protege unicidade em concorrência e permite mesmo lote em outra planta', async () => {
    const results = await Promise.all([create(), create()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await api()
      .post(`/v1/plantas/${outraPlanta}/marcadores`)
      .auth(token(), { type: 'bearer' })
      .send({ loteId: lotes[0], x: 0.5, y: 0.5 })
      .expect(201);
  });
  it('cria em lote e reverte todos os itens em conflito', async () => {
    await api()
      .post(url() + '/marcadores/lote')
      .auth(token(), { type: 'bearer' })
      .send({
        marcadores: lotes
          .slice(0, 2)
          .map((loteId) => ({ loteId, x: 0.5, y: 0.5 })),
      })
      .expect(201);
    await api()
      .post(url() + '/marcadores/lote')
      .auth(token(), { type: 'bearer' })
      .send({
        marcadores: [lotes[2], lotes[0]].map((loteId) => ({
          loteId,
          x: 0.5,
          y: 0.5,
        })),
      })
      .expect(409);
    expect(await prisma.marcador.count()).toBe(2);
    await api()
      .post(url() + '/marcadores/lote')
      .auth(token(), { type: 'bearer' })
      .send({
        marcadores: [lotes[2], lotes[2]].map((loteId) => ({
          loteId,
          x: 0.5,
          y: 0.5,
        })),
      })
      .expect(409);
    await api()
      .post(url() + '/marcadores/lote')
      .auth(token(), { type: 'bearer' })
      .send({ marcadores: [] })
      .expect(400);
  });
  it.each(['CONSULTA', 'COMERCIAL'] as const)(
    'permite leitura e nega escrita para %s',
    async (perfil) => {
      const m = (await create().expect(201)).body;
      await api()
        .get(url() + '/marcadores')
        .auth(usuarios[perfil].token, { type: 'bearer' })
        .expect(200);
      for (const [method, path, body] of [
        ['post', '/marcadores', { loteId: lotes[1], x: 0, y: 0 }],
        ['post', '/marcadores/lote', { marcadores: [] }],
        ['patch', '/marcadores/' + m.id, { x: 0, y: 0 }],
        ['delete', '/marcadores/' + m.id, {}],
      ] as const)
        await api()
          [method](url() + path)
          .auth(usuarios[perfil].token, { type: 'bearer' })
          .send(body)
          .expect(403);
    },
  );
  it('aceita administrador e exige autenticação', async () => {
    await api()
      .get(url() + '/marcadores')
      .expect(401);
    await api()
      .post(url() + '/marcadores')
      .auth(usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .send({ loteId: lotes[0], x: 0.5, y: 0.5 })
      .expect(201);
  });
  it('respeita a planta do marcador e valida recursos existentes', async () => {
    const m = (await create().expect(201)).body;
    await api()
      .patch(`/v1/plantas/${outraPlanta}/marcadores/${m.id}`)
      .auth(token(), { type: 'bearer' })
      .send({ x: 0, y: 0 })
      .expect(404);
    await api()
      .delete(`/v1/plantas/${outraPlanta}/marcadores/${m.id}`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    await create(randomUUID()).expect(404);
    await api()
      .get(`/v1/plantas/${randomUUID()}/marcadores`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    expect(
      (
        await api()
          .get(url() + '/lotes-sem-marcador?loteamentoId=' + randomUUID())
          .auth(token(), { type: 'bearer' })
          .expect(200)
      ).body.meta.total,
    ).toBe(0);
  });
  it('reverte escrita quando auditoria falha e documenta rotas', async () => {
    vi.spyOn(app.get(AuditoriaService), 'registrarVarios').mockRejectedValue(
      new Error('falha simulada'),
    );
    await create().expect(500);
    expect(await prisma.marcador.count()).toBe(0);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(
      doc.paths['/v1/plantas/{plantaId}/marcadores'].post?.responses,
    ).toHaveProperty('409');
  });
});
