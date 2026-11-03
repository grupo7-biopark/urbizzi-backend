import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
describe('Consulta do histórico (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gestor: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let comercial: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let outro: Awaited<ReturnType<typeof criarUsuarioTeste>>;
  let reservaId: string;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    gestor = await criarUsuarioTeste(app, 'GESTOR');
    comercial = await criarUsuarioTeste(app, 'COMERCIAL');
    outro = await criarUsuarioTeste(app, 'COMERCIAL');
    const loteamento = await prisma.loteamento.create({
      data: { nome: 'Teste' },
    });
    const quadra = await prisma.quadra.create({
      data: { numero: '1', loteamentoId: loteamento.id },
    });
    const cliente = await prisma.cliente.create({
      data: { nome: 'Cliente Teste', documento: '52998224725' },
    });
    const reservas: string[] = [];
    for (const [i, vendedor] of [comercial, outro].entries()) {
      const lote = await prisma.lote.create({
        data: { quadraId: quadra.id, numero: String(i), areaM2: '200' },
      });
      const reserva = await prisma.reserva.create({
        data: {
          loteId: lote.id,
          clienteId: cliente.id,
          vendedorId: vendedor.id,
          dataInicio: new Date('2026-11-01T12:00:00Z'),
          dataVencimento: new Date('2026-11-10T12:00:00Z'),
        },
      });
      reservas.push(reserva.id);
    }
    reservaId = reservas[0];
    const proposta = await prisma.proposta.create({
      data: {
        reservaId,
        vendedorId: comercial.id,
        valor: '100000',
        condicoes: 'Teste',
        prazoLimite: new Date('2026-11-10T12:00:00Z'),
      },
    });
    await prisma.historicoAuditoria.createMany({
      data: [
        {
          entidadeTipo: 'Reserva',
          entidadeId: reservas[0],
          usuarioId: gestor.id,
          acao: 'ALTERAR',
          createdAt: new Date('2026-11-01T23:59:59Z'),
        },
        {
          entidadeTipo: 'Reserva',
          entidadeId: reservas[1],
          usuarioId: comercial.id,
          acao: 'ALTERAR',
          createdAt: new Date('2026-11-02T12:00:00Z'),
        },
        {
          entidadeTipo: 'Proposta',
          entidadeId: proposta.id,
          usuarioId: outro.id,
          acao: 'CRIAR',
          createdAt: new Date('2026-11-03T12:00:00Z'),
        },
        {
          entidadeTipo: 'Cliente',
          entidadeId: cliente.id,
          usuarioId: comercial.id,
          acao: 'CRIAR',
          createdAt: new Date('2026-11-03T13:00:00Z'),
        },
        {
          entidadeTipo: 'Reserva',
          entidadeId: reservas[0],
          usuarioId: null,
          acao: 'EXPIRAR',
          createdAt: new Date('2026-11-04T12:00:00Z'),
        },
      ],
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('gestor combina filtros, inclui o dia final e recebe nome do autor', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/historico')
      .query({
        entidadeTipo: 'Reserva',
        entidadeId: reservaId,
        usuarioId: gestor.id,
        dataDe: '2026-11-01',
        dataAte: '2026-11-01',
      })
      .auth(gestor.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].usuario).toEqual({
      id: gestor.id,
      nome: gestor.nome,
    });
    expect(res.body.data[0].usuario).not.toHaveProperty('email');
  });
  it('pagina com ordenação mais recente e representa usuário de sistema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/historico?pageSize=2')
      .auth(gestor.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.meta).toMatchObject({
      total: 5,
      pageSize: 2,
      totalPages: 3,
    });
    expect(res.body.data[0].acao).toBe('EXPIRAR');
    expect(res.body.data[0].usuario).toBeNull();
    const vazio = await request(app.getHttpServer())
      .get('/v1/historico?page=50')
      .auth(gestor.token, { type: 'bearer' })
      .expect(200);
    expect(vazio.body.data).toEqual([]);
  });
  it('Comercial vê propriedade real mesmo se outro usuário executou a alteração', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/historico')
      .auth(comercial.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.meta.total).toBe(3);
    expect(
      res.body.data.some(
        (row: { usuario: { id: string } | null }) =>
          row.usuario?.id === gestor.id,
      ),
    ).toBe(true);
    const alheio = await request(app.getHttpServer())
      .get('/v1/historico')
      .query({ usuarioId: comercial.id })
      .auth(comercial.token, { type: 'bearer' })
      .expect(200);
    expect(alheio.body.meta.total).toBe(0);
    const filtrado = await request(app.getHttpServer())
      .get('/v1/historico')
      .query({ entidadeTipo: 'Cliente' })
      .auth(comercial.token, { type: 'bearer' })
      .expect(200);
    expect(filtrado.body.data).toEqual([]);
  });
  it('Administrador vê tudo, Consulta recebe 403 e sem token recebe 401', async () => {
    const admin = await criarUsuarioTeste(app, 'ADMINISTRADOR');
    const consulta = await criarUsuarioTeste(app, 'CONSULTA');
    const res = await request(app.getHttpServer())
      .get('/v1/historico')
      .auth(admin.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.meta.total).toBe(5);
    await request(app.getHttpServer())
      .get('/v1/historico')
      .auth(consulta.token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer()).get('/v1/historico').expect(401);
  });
  it('valida UUID, paginação e período', async () => {
    for (const query of [
      { entidadeId: 'x' },
      { usuarioId: 'x' },
      { dataDe: '2026-02-30' },
      { pageSize: 101 },
    ])
      await request(app.getHttpServer())
        .get('/v1/historico')
        .query(query)
        .auth(gestor.token, { type: 'bearer' })
        .expect(400);
    const res = await request(app.getHttpServer())
      .get('/v1/historico')
      .query({ dataDe: '2026-11-03', dataAte: '2026-11-01' })
      .auth(gestor.token, { type: 'bearer' })
      .expect(422);
    expect(res.body.code).toBe('PERIODO_INVALIDO');
  });
});
