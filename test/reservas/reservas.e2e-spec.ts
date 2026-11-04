import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
describe('Criar reserva (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let c: Awaited<ReturnType<typeof criarCenarioMapa>>;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  const criar = (
    loteId = c.lotes[0].id,
    clienteId = c.cliente.id,
    perfil: keyof typeof c.usuarios = 'COMERCIAL',
  ) =>
    request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios[perfil].token, { type: 'bearer' })
      .send({ loteId, clienteId });
  it('cria reserva com prazo configurado, marca histórico e audita atomicamente', async () => {
    await prisma.configuracao.create({
      data: { chave: 'prazo_reserva_dias', valor: '3' },
    });
    const res = await criar().expect(201);
    expect(res.body.vendedorId).toBe(c.usuarios.COMERCIAL.id);
    expect(
      new Date(res.body.dataVencimento).getTime() -
        new Date(res.body.dataInicio).getTime(),
    ).toBe(3 * 86400000);
    const lote = await prisma.lote.findUniqueOrThrow({
      where: { id: c.lotes[0].id },
    });
    expect(lote).toMatchObject({ status: 'RESERVADO', teveReserva: true });
    const a = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: { in: [res.body.id, lote.id] } },
    });
    expect(a).toHaveLength(2);
    expect(JSON.stringify(a)).not.toContain(c.cliente.documento);
    const detalhe = await request(app.getHttpServer())
      .get('/v1/reservas/' + res.body.id)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    expect(detalhe.body.tempoRestanteSegundos).toBeGreaterThan(0);
  });
  it('apenas uma de duas requisições concorrentes reserva o lote', async () => {
    const r = await Promise.all([criar(), criar()]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.reserva.count({
        where: { loteId: c.lotes[0].id, status: 'ATIVA' },
      }),
    ).toBe(1);
  });
  it('serializa exclusão concorrente sem reservar lote removido', async () => {
    const [r, d] = await Promise.all([
      criar(),
      request(app.getHttpServer())
        .delete('/v1/lotes/' + c.lotes[0].id)
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' }),
    ]);
    expect([
      [201, 409],
      [404, 204],
    ]).toContainEqual([r.status, d.status]);
  });
  it.each([1, 2, 3])('nega lote indisponível %s', async (i) => {
    await criar(c.lotes[i].id).expect(409);
  });
  it('nega recursos ausentes, corpo inválido e perfis sem permissão', async () => {
    await criar(randomUUID()).expect(404);
    await criar(c.lotes[0].id, randomUUID()).expect(404);
    await criar(c.lotes[0].id, c.cliente.id, 'CONSULTA').expect(403);
    await request(app.getHttpServer())
      .post('/v1/reservas')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({
        loteId: c.lotes[0].id,
        clienteId: c.cliente.id,
        vendedorId: c.usuarios.GESTOR.id,
      })
      .expect(400);
  });
  it('protege detalhe de outro vendedor e permite gestor', async () => {
    const r = await criar().expect(201);
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    await request(app.getHttpServer())
      .get('/v1/reservas/' + r.body.id)
      .auth(outro.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/reservas/' + r.body.id)
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/reservas/' + randomUUID())
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(404);
  });
  it('mantém a constraint parcial como defesa adicional e documenta rotas', async () => {
    await prisma.reserva.create({
      data: {
        loteId: c.lotes[0].id,
        clienteId: c.cliente.id,
        vendedorId: c.usuarios.COMERCIAL.id,
        dataInicio: new Date(),
        dataVencimento: new Date(Date.now() + 86400000),
      },
    });
    expect((await criar().expect(409)).body.code).toBe(
      'RESERVA_LOTE_JA_RESERVADO',
    );
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }))
        .status,
    ).toBe('DISPONIVEL');
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(doc.paths['/v1/reservas'].post?.responses).toHaveProperty('201');
    expect(doc.paths['/v1/reservas/{id}'].get?.responses).toHaveProperty('200');
  });
  it('rollback restaura lote, histórico e reserva se auditoria falha', async () => {
    const audit = app.get(AuditoriaService);
    const original = audit.registrar.bind(audit);
    vi.spyOn(audit, 'registrar').mockImplementation((input, tx) => {
      if (input.entidadeTipo === 'Reserva') throw new Error('Falha simulada');
      return original(input, tx);
    });
    await criar().expect(500);
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }))
        .status,
    ).toBe('DISPONIVEL');
    expect(
      await prisma.reserva.count({ where: { loteId: c.lotes[0].id } }),
    ).toBe(0);
    expect(
      await prisma.historicoAuditoria.count({
        where: { entidadeId: c.lotes[0].id },
      }),
    ).toBe(0);
  });
});
