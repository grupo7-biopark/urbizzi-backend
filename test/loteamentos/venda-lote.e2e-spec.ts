import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';

describe('Venda do lote (e2e)', () => {
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

  const loteUrl = () => '/v1/lotes/' + c.reserva.loteId;
  const venda = (perfil: keyof typeof c.usuarios = 'GESTOR', url = loteUrl()) =>
    request(app.getHttpServer())
      .post(url + '/vender')
      .auth(c.usuarios[perfil].token, { type: 'bearer' });

  it('registra uma única venda concorrente, converte a reserva e audita as duas transições', async () => {
    const respostas = await Promise.all([venda(), venda('ADMINISTRADOR')]);
    expect(respostas.map((r) => r.status).sort()).toEqual([204, 409]);

    const auditorias = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: { in: [c.reserva.id, c.reserva.loteId] } },
    });
    expect(auditorias).toHaveLength(2);
    expect(auditorias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acao: 'VENDER',
          valorNovo: { status: 'VENDIDO' },
        }),
        expect.objectContaining({
          acao: 'CONVERTER',
          valorNovo: expect.objectContaining({ status: 'CONVERTIDA' }),
        }),
      ]),
    );

    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: c.reserva.id } }))
        .status,
    ).toBe('CONVERTIDA');

    for (const operacao of ['bloquear', 'desbloquear']) {
      await request(app.getHttpServer())
        .post(loteUrl() + '/' + operacao)
        .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
        .send(operacao === 'bloquear' ? { motivo: 'Teste de bloqueio' } : {})
        .expect(409);
    }
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.reserva.loteId } }))
        .status,
    ).toBe('VENDIDO');
  });

  it('desfaz venda e conversão se a auditoria falhar', async () => {
    const auditoria = app.get(AuditoriaService);
    const registrar = auditoria.registrar.bind(auditoria);
    vi.spyOn(auditoria, 'registrar').mockImplementation((input, tx) => {
      if (input.acao === 'CONVERTER')
        return Promise.reject(new Error('Falha simulada'));
      return registrar(input, tx);
    });
    await venda().expect(500);
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.reserva.loteId } }))
        .status,
    ).toBe('RESERVADO');
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: c.reserva.id } }))
        .status,
    ).toBe('ATIVA');
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });

  it('rejeita perfis sem acesso, lote inexistente, sem reserva ou sem aprovação', async () => {
    await venda('COMERCIAL').expect(403);
    await venda('CONSULTA').expect(403);
    await venda('GESTOR', '/v1/lotes/' + randomUUID()).expect(404);
    const semReserva = await venda(
      'GESTOR',
      '/v1/lotes/' + c.lotes[0].id,
    ).expect(409);
    expect(semReserva.body.code).toBe('LOTE_SEM_RESERVA_ATIVA');

    await prisma.proposta.updateMany({
      where: { reservaId: c.reserva.id },
      data: {
        status: 'EM_ANALISE',
        dataDecisao: null,
        decididoPorId: null,
        motivoDecisao: null,
      },
    });
    const semAprovacao = await venda().expect(409);
    expect(semAprovacao.body.code).toBe('LOTE_SEM_PROPOSTA_APROVADA');
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });

  it('preserva a venda com proposta aprovada após o vencimento da reserva ativa', async () => {
    await prisma.reserva.update({
      where: { id: c.reserva.id },
      data: {
        dataInicio: new Date(Date.now() - 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      },
    });
    await venda('ADMINISTRADOR').expect(204);
  });

  it('recusa vender uma reserva ativa vinculada a lote com status incompatível', async () => {
    await prisma.lote.update({
      where: { id: c.reserva.loteId },
      data: { status: 'BLOQUEADO' },
    });
    const r = await venda().expect(409);
    expect(r.body.code).toBe('LOTE_NAO_RESERVADO');
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });

  it('documenta a rota e o status no Swagger', () => {
    const { paths } = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(paths['/v1/lotes/{id}/vender']?.post?.responses).toHaveProperty(
      '204',
    );
  });
});
