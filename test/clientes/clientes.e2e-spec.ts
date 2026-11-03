import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
describe('Clientes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const input = {
    nome: 'José da Silva',
    documento: '529.982.247-25',
    email: 'cliente@exemplo.com',
  };
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    token = (await criarUsuarioTeste(app, 'COMERCIAL')).token;
  });
  afterAll(async () => {
    await app?.close();
  });
  const create = (body: object = input) =>
    request(app.getHttpServer())
      .post('/v1/clientes')
      .auth(token, { type: 'bearer' })
      .send(body);
  it('cria, detalha e edita cliente com documento normalizado e auditoria mascarada', async () => {
    const res = await create().expect(201);
    expect(res.body.documento).toBe('52998224725');
    await request(app.getHttpServer())
      .get(`/v1/clientes/${res.body.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    const edit = await request(app.getHttpServer())
      .patch(`/v1/clientes/${res.body.id}`)
      .auth(token, { type: 'bearer' })
      .send({ telefone: '45999999999', email: null })
      .expect(200);
    expect(edit.body.nome).toBe(input.nome);
    expect(edit.body.email).toBeNull();
    const audit = JSON.stringify(await prisma.historicoAuditoria.findMany());
    expect(audit).not.toContain(input.nome);
    expect(audit).not.toContain(input.email);
    expect(audit).not.toContain('52998224725');
  });
  it('busca sem acentos, por documento formatado e sem expor contatos na listagem', async () => {
    await create().expect(201);
    await create({ nome: 'Empresa', documento: '04.252.011/0001-10' }).expect(
      201,
    );
    for (const q of ['Jose', 'JOSÉ', '529.982.247-25', '982247']) {
      const res = await request(app.getHttpServer())
        .get('/v1/clientes')
        .query({ q, pageSize: 1 })
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0]).toEqual({
        id: expect.any(String),
        nome: input.nome,
      });
    }
    const vazio = await request(app.getHttpServer())
      .get('/v1/clientes?page=50')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(vazio.body.data).toEqual([]);
  });
  it('rejeita CPF/CNPJ, nome vazio, tipos inválidos e duplicidade', async () => {
    for (const documento of [
      '11111111111',
      '52998224724',
      '04252011000111',
      null,
      123,
    ])
      await create({ ...input, documento }).expect(400);
    await create({ ...input, nome: ' ' }).expect(400);
    await create().expect(201);
    const dup = await create().expect(409);
    expect(dup.body.code).toBe('CLIENTE_DOCUMENTO_DUPLICADO');
    await request(app.getHttpServer())
      .patch(`/v1/clientes/${randomUUID()}`)
      .auth(token, { type: 'bearer' })
      .send({ nome: 'Outro' })
      .expect(404);
  });
  it('Consulta não acessa dados pessoais; gestores e administradores acessam', async () => {
    const cliente = (await create().expect(201)).body;
    for (const perfil of ['CONSULTA', 'GESTOR', 'ADMINISTRADOR'] as const) {
      const usuario = await criarUsuarioTeste(app, perfil);
      const status = perfil === 'CONSULTA' ? 403 : 200;
      await request(app.getHttpServer())
        .get('/v1/clientes')
        .auth(usuario.token, { type: 'bearer' })
        .expect(status);
      await request(app.getHttpServer())
        .get(`/v1/clientes/${cliente.id}`)
        .auth(usuario.token, { type: 'bearer' })
        .expect(status);
      if (perfil === 'CONSULTA') {
        await request(app.getHttpServer())
          .patch(`/v1/clientes/${cliente.id}`)
          .auth(usuario.token, { type: 'bearer' })
          .send({ nome: 'Não permitido' })
          .expect(403);
        await request(app.getHttpServer())
          .post('/v1/clientes')
          .auth(usuario.token, { type: 'bearer' })
          .send(input)
          .expect(403);
      }
    }
    await request(app.getHttpServer()).get('/v1/clientes').expect(401);
  });
  it('não deixa cliente persistido se a auditoria falhar', async () => {
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('Falha forçada'));
    try {
      await create().expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.cliente.count()).toBe(0);
  });
  it('duplicidade concorrente preserva somente um cadastro', async () => {
    const results = await Promise.all([create(), create()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.cliente.count()).toBe(1);
  });
});
