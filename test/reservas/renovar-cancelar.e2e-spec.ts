import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { ExpiracaoReservaService } from '../../src/modules/reservas/application/services/expiracao-reserva.service.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
describe('Renovar e cancelar reservas (BE-20)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    c: Awaited<ReturnType<typeof criarCenarioMapa>>,
    id: string;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => app?.close());
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
    const res = await request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ loteId: c.lotes[0].id, clienteId: c.cliente.id })
      .expect(201);
    id = res.body.id;
  });
  const post = (acao: string, dados: unknown = {}, token?: string) =>
    request(app.getHttpServer())
      .post(`/v1/reservas/${id}/${acao}`)
      .auth(token ?? c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send(dados);
  const proposta = async (aprovar = false) => {
    const res = await request(app.getHttpServer())
      .post(`/v1/reservas/${id}/propostas`)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ valor: '200000.00', condicoes: 'À vista' })
      .expect(201);
    if (aprovar)
      await request(app.getHttpServer())
        .post(`/v1/propostas/${res.body.id}/aprovar`)
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .send({ motivo: 'Aprovação original' })
        .expect(200);
    return prisma.proposta.findUniqueOrThrow({ where: { id: res.body.id } });
  };
  const vencer = () =>
    prisma.reserva.update({
      where: { id },
      data: {
        dataInicio: new Date(Date.now() - 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      },
    });
  it('renova pelo prazo configurado, audita e pagina o histórico', async () => {
    await prisma.configuracao.create({
      data: { chave: 'prazo_reserva_dias', valor: '3' },
    });
    const antes = await prisma.reserva.findUniqueOrThrow({ where: { id } });
    await post('renovar').expect(200);
    await post('renovar', {}, c.usuarios.GESTOR.token).expect(200);
    const depois = await prisma.reserva.findUniqueOrThrow({ where: { id } });
    expect(
      depois.dataVencimento.getTime() - antes.dataVencimento.getTime(),
    ).toBe(6 * 86400000);
    const historico = await request(app.getHttpServer())
      .get(`/v1/reservas/${id}/renovacoes?pageSize=1`)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    expect(historico.body.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(historico.body.data).toHaveLength(1);
    expect(
      await prisma.historicoAuditoria.count({
        where: { entidadeId: id, acao: 'RENOVAR' },
      }),
    ).toBe(2);
  });
  it('nega vencida e limite atingido', async () => {
    await prisma.configuracao.create({
      data: { chave: 'limite_renovacoes', valor: '1' },
    });
    await post('renovar').expect(200);
    expect((await post('renovar').expect(409)).body.code).toBe(
      'LIMITE_RENOVACOES_ATINGIDO',
    );
    await vencer();
    expect((await post('renovar').expect(409)).body.code).toBe(
      'RESERVA_VENCIDA',
    );
  });
  it('nega limite inválido sem gravar renovação', async () => {
    await prisma.configuracao.create({
      data: { chave: 'limite_renovacoes', valor: '-1' },
    });
    expect((await post('renovar').expect(422)).body.code).toBe(
      'CONFIGURACAO_INVALIDA',
    );
    expect(
      await prisma.reservaRenovacao.count({ where: { reservaId: id } }),
    ).toBe(0);
  });
  it('serializa renovações concorrentes com limite de uma', async () => {
    await prisma.configuracao.create({
      data: { chave: 'limite_renovacoes', valor: '1' },
    });
    const respostas = await Promise.all([post('renovar'), post('renovar')]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.reservaRenovacao.count({ where: { reservaId: id } }),
    ).toBe(1);
  });
  it('valida motivo e nega Consulta ou outro Comercial, inclusive no histórico', async () => {
    await post('cancelar').expect(400);
    await post('cancelar', { motivo: '   ' }).expect(400);
    await post('renovar', {}, c.usuarios.CONSULTA.token).expect(403);
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    await post('cancelar', { motivo: 'Desistência' }, outro.token).expect(403);
    await post('renovar', {}, outro.token).expect(403);
    await request(app.getHttpServer())
      .get(`/v1/reservas/${id}/renovacoes`)
      .auth(outro.token, { type: 'bearer' })
      .expect(403);
  });
  it.each([false, true])(
    'exige confirmação e preserva decisão de proposta aprovada=%s',
    async (aprovada) => {
      const p = await proposta(aprovada);
      expect(
        (await post('cancelar', { motivo: 'Desistência' }).expect(409)).body
          .code,
      ).toBe('CONFIRMACAO_CANCELAMENTO_NECESSARIA');
      await post('cancelar', { motivo: 'Desistência', confirmar: true }).expect(
        200,
      );
      const atual = await prisma.proposta.findUniqueOrThrow({
        where: { id: p.id },
      });
      expect(atual).toMatchObject({
        status: p.status,
        decididoPorId: p.decididoPorId,
        dataDecisao: p.dataDecisao,
        motivoDecisao: p.motivoDecisao,
        motivoEncerramento: 'Desistência',
        dataEncerramento: expect.any(Date),
      });
      expect(
        await prisma.reserva.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        status: 'CANCELADA',
        motivoEncerramento: 'Desistência',
      });
      expect(
        await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
      ).toMatchObject({ status: 'DISPONIVEL' });
      const pendentes = await request(app.getHttpServer())
        .get('/v1/propostas/pendentes')
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .expect(200);
      expect(
        pendentes.body.data.map((item: { id: string }) => item.id),
      ).not.toContain(p.id);
      await request(app.getHttpServer())
        .post(`/v1/propostas/${p.id}/rejeitar`)
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .send({ motivo: 'Outra decisão' })
        .expect(409);
      expect(
        await prisma.historicoAuditoria.count({
          where: { entidadeId: p.id, acao: 'ENCERRAR_POR_CANCELAMENTO' },
        }),
      ).toBe(1);
    },
  );
  it.each(['RENOVAR', 'CANCELAR', 'ENCERRAR_POR_CANCELAMENTO'])(
    'desfaz tudo quando falha a auditoria de %s',
    async (acao) => {
      const p = await proposta(true);
      const antes = await prisma.reserva.findUniqueOrThrow({ where: { id } });
      const audit = app.get(AuditoriaService),
        original = audit.registrar.bind(audit);
      vi.spyOn(audit, 'registrar').mockImplementation(async (dados, tx) => {
        const r = await original(dados, tx);
        if (dados.acao === acao) throw new Error('Falha simulada');
        return r;
      });
      await post(acao === 'RENOVAR' ? 'renovar' : 'cancelar', {
        motivo: 'Desistência',
        confirmar: true,
      }).expect(500);
      expect(
        await prisma.reserva.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        status: 'ATIVA',
        dataVencimento: antes.dataVencimento,
      });
      expect(
        await prisma.proposta.findUniqueOrThrow({ where: { id: p.id } }),
      ).toMatchObject({ dataEncerramento: null, status: 'APROVADA' });
      expect(
        await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
      ).toMatchObject({ status: 'RESERVADO' });
    },
  );
  it('serializa cancelamento e expiração sem liberar o lote duas vezes', async () => {
    await vencer();
    const [cancelamento] = await Promise.all([
      post('cancelar', { motivo: 'Desistência' }),
      app.get(ExpiracaoReservaService).executar(),
    ]);
    expect([200, 409]).toContain(cancelamento.status);
    const reserva = await prisma.reserva.findUniqueOrThrow({ where: { id } });
    expect(['CANCELADA', 'EXPIRADA']).toContain(reserva.status);
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }),
    ).toMatchObject({ status: 'DISPONIVEL' });
  });
  it('serializa cancelamento e venda sem deixar reserva e lote divergentes', async () => {
    await proposta(true);
    const [cancelar, vender] = await Promise.all([
      post('cancelar', { motivo: 'Desistência', confirmar: true }),
      request(app.getHttpServer())
        .post(`/v1/lotes/${c.lotes[0].id}/vender`)
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' }),
    ]);
    expect([cancelar.status, vender.status].sort()).toEqual(
      cancelar.status === 200 ? [200, 409] : [204, 409],
    );
    const reserva = await prisma.reserva.findUniqueOrThrow({ where: { id } });
    const lote = await prisma.lote.findUniqueOrThrow({
      where: { id: c.lotes[0].id },
    });
    expect([
      ['CANCELADA', 'DISPONIVEL'],
      ['CONVERTIDA', 'VENDIDO'],
    ]).toContainEqual([reserva.status, lote.status]);
  });
});
