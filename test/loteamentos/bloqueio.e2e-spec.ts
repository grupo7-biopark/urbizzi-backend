import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
describe('Bloqueio de lotes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let id: string;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    token = (await criarUsuarioTeste(app, 'GESTOR')).token;
    const loteamento = await prisma.loteamento.create({
      data: { nome: 'Teste' },
    });
    const quadra = await prisma.quadra.create({
      data: { loteamentoId: loteamento.id, numero: '1' },
    });
    id = (
      await prisma.lote.create({
        data: { quadraId: quadra.id, numero: '1', areaM2: '200' },
      })
    ).id;
  });
  afterAll(async () => {
    await app?.close();
  });
  const bloquear = (body: object = { motivo: 'Motivo administrativo' }) =>
    request(app.getHttpServer())
      .post(`/v1/lotes/${id}/bloquear`)
      .auth(token, { type: 'bearer' })
      .send(body);
  it('bloqueia/desbloqueia com auditoria e motivo; status não é editável no CRUD', async () => {
    const res = await bloquear({ motivo: ' Motivo administrativo ' }).expect(
      200,
    );
    expect(res.body.status).toBe('BLOQUEADO');
    const audit = await prisma.historicoAuditoria.findFirstOrThrow();
    expect(audit).toMatchObject({
      motivo: 'Motivo administrativo',
      acao: 'BLOQUEAR',
      valorAnterior: { status: 'DISPONIVEL' },
      valorNovo: { status: 'BLOQUEADO' },
    });
    await request(app.getHttpServer())
      .patch(`/v1/lotes/${id}`)
      .auth(token, { type: 'bearer' })
      .send({ status: 'RESERVADO' })
      .expect(400);
    const admin = await criarUsuarioTeste(app, 'ADMINISTRADOR');
    const unblocked = await request(app.getHttpServer())
      .post(`/v1/lotes/${id}/desbloquear`)
      .auth(admin.token, { type: 'bearer' })
      .expect(200);
    expect(unblocked.body.status).toBe('DISPONIVEL');
    expect(await prisma.historicoAuditoria.count()).toBe(2);
  });
  it.each(['RESERVADO', 'VENDIDO', 'BLOQUEADO'] as const)(
    'não bloqueia estado %s',
    async (status) => {
      await prisma.lote.update({ where: { id }, data: { status } });
      await bloquear().expect(409);
      expect(await prisma.historicoAuditoria.count()).toBe(0);
    },
  );
  it('não desbloqueia disponível ou vendido e exige motivo no bloqueio', async () => {
    await request(app.getHttpServer())
      .post(`/v1/lotes/${id}/desbloquear`)
      .auth(token, { type: 'bearer' })
      .expect(409);
    for (const body of [
      {},
      { motivo: '' },
      { motivo: ' ' },
      { motivo: null },
      { motivo: 'x'.repeat(1001) },
    ])
      await bloquear(body).expect(400);
    await prisma.lote.update({ where: { id }, data: { status: 'VENDIDO' } });
    await request(app.getHttpServer())
      .post(`/v1/lotes/${id}/desbloquear`)
      .auth(token, { type: 'bearer' })
      .expect(409);
  });
  it('nega demais perfis, anônimo e lote inexistente', async () => {
    for (const perfil of ['COMERCIAL', 'CONSULTA'] as const) {
      const usuario = await criarUsuarioTeste(app, perfil);
      for (const acao of ['bloquear', 'desbloquear'])
        await request(app.getHttpServer())
          .post(`/v1/lotes/${id}/${acao}`)
          .auth(usuario.token, { type: 'bearer' })
          .send({ motivo: 'Motivo' })
          .expect(403);
    }
    await request(app.getHttpServer())
      .post(`/v1/lotes/${id}/bloquear`)
      .send({ motivo: 'Motivo' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/lotes/${randomUUID()}/bloquear`)
      .auth(token, { type: 'bearer' })
      .send({ motivo: 'Motivo' })
      .expect(404);
  });
  it('bloqueios concorrentes produzem uma única transição e auditoria', async () => {
    const results = await Promise.all([bloquear(), bloquear()]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await prisma.historicoAuditoria.count()).toBe(1);
  });
  it('falha na auditoria desfaz a mudança de status', async () => {
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('Falha forçada'));
    try {
      await bloquear().expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('DISPONIVEL');
  });
});
