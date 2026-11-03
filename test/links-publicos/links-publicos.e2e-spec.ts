import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { LinkPublicoService } from '../../src/modules/links-publicos/application/services/link-publico.service.js';
describe('Links públicos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let comercial: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    comercial = await criarUsuarioTeste(app, 'COMERCIAL');
  });
  afterAll(async () => {
    await app?.close();
  });
  const create = (token = comercial.token, body: object = {}) =>
    request(app.getHttpServer())
      .post('/v1/links-publicos')
      .auth(token, { type: 'bearer' })
      .send(body);
  it('cria token, valida escopo opcional e audita sem segredos', async () => {
    const loteamento = await prisma.loteamento.create({
      data: { nome: 'Teste' },
    });
    const result = await create(comercial.token, {
      loteamentoId: loteamento.id,
    }).expect(201);
    expect(result.body).toMatchObject({
      criadoPorId: comercial.id,
      ativo: true,
      acessos: 0,
      loteamentoId: loteamento.id,
    });
    expect(result.body.token).toHaveLength(43);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(
      JSON.stringify(await prisma.historicoAuditoria.findMany()),
    ).not.toContain(result.body.token);
    await create(comercial.token, { loteamentoId: randomUUID() }).expect(404);
    await create(comercial.token, { loteamentoId: 'x' }).expect(400);
  });
  it('Comercial lista/desativa só os próprios links; Gestor/Admin têm visão geral', async () => {
    const own = (await create().expect(201)).body;
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    const theirs = (await create(outro.token).expect(201)).body;
    const res = await request(app.getHttpServer())
      .get('/v1/links-publicos')
      .auth(comercial.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].id).toBe(own.id);
    await request(app.getHttpServer())
      .post(`/v1/links-publicos/${theirs.id}/desativar`)
      .auth(comercial.token, { type: 'bearer' })
      .expect(403);
    for (const perfil of ['GESTOR', 'ADMINISTRADOR'] as const) {
      const gestor = await criarUsuarioTeste(app, perfil);
      const list = await request(app.getHttpServer())
        .get('/v1/links-publicos?pageSize=1')
        .auth(gestor.token, { type: 'bearer' })
        .expect(200);
      expect(list.body.meta.total).toBe(2);
      await request(app.getHttpServer())
        .post(`/v1/links-publicos/${theirs.id}/desativar`)
        .auth(gestor.token, { type: 'bearer' })
        .expect(200);
      await create(gestor.token).expect(201);
      await prisma.linkPublico.deleteMany({
        where: { criadoPorId: gestor.id },
      });
    }
  });
  it('contador é atômico e link inativo deixa de funcionar imediatamente', async () => {
    const link = (await create().expect(201)).body;
    const service = app.get(LinkPublicoService);
    await Promise.all(
      Array.from({ length: 10 }, () => service.registrarAcesso(link.token)),
    );
    expect(
      (await prisma.linkPublico.findUniqueOrThrow({ where: { id: link.id } }))
        .acessos,
    ).toBe(10);
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post(`/v1/links-publicos/${link.id}/desativar`)
        .auth(comercial.token, { type: 'bearer' })
        .expect(200);
    await expect(service.registrarAcesso(link.token)).rejects.toMatchObject({
      code: 'LINK_NAO_ENCONTRADO',
    });
    expect(
      await prisma.historicoAuditoria.count({ where: { acao: 'DESATIVAR' } }),
    ).toBe(1);
  });
  it('Consulta não cria/lista/desativa; anônimo não acessa', async () => {
    const own = (await create().expect(201)).body;
    const consulta = await criarUsuarioTeste(app, 'CONSULTA');
    await create(consulta.token).expect(403);
    await request(app.getHttpServer())
      .get('/v1/links-publicos')
      .auth(consulta.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/links-publicos/${own.id}/desativar`)
      .auth(consulta.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer()).get('/v1/links-publicos').expect(401);
    await request(app.getHttpServer())
      .post(`/v1/links-publicos/${randomUUID()}/desativar`)
      .auth(comercial.token, { type: 'bearer' })
      .expect(404);
  });
  it('auditoria falhando desfaz criação', async () => {
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('Falha forçada'));
    try {
      await create().expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.linkPublico.count()).toBe(0);
  });
});
