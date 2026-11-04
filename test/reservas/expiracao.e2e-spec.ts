import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { ExpiracaoReservaService } from '../../src/modules/reservas/application/services/expiracao-reserva.service.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
describe('Expiração automática (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let c: Awaited<ReturnType<typeof criarCenarioMapa>>;
  let service: ExpiracaoReservaService;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    service = app.get(ExpiracaoReservaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  async function vencida(numero = 'Expirar') {
    const lote = await prisma.lote.create({
      data: {
        quadraId: c.quadras[0].id,
        numero,
        areaM2: '100',
        status: 'RESERVADO',
        teveReserva: true,
      },
    });
    const reserva = await prisma.reserva.create({
      data: {
        loteId: lote.id,
        clienteId: c.cliente.id,
        vendedorId: c.usuarios.COMERCIAL.id,
        dataInicio: new Date(Date.now() - 10 * 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      },
    });
    return { lote, reserva };
  }
  it('expira somente elegíveis, preserva aprovada e agenda intervalo', async () => {
    const v = await vencida();
    await prisma.reserva.update({
      where: { id: c.reserva.id },
      data: {
        dataInicio: new Date(Date.now() - 10 * 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      },
    });
    const cancelada = await vencida('Cancelada');
    await prisma.reserva.update({
      where: { id: cancelada.reserva.id },
      data: { status: 'CANCELADA' },
    });
    const futura = await vencida('Futura');
    await prisma.reserva.update({
      where: { id: futura.reserva.id },
      data: { dataVencimento: new Date(Date.now() + 86400000) },
    });
    expect(await service.executar()).toEqual({ expiradas: 1, falhas: 0 });
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: v.reserva.id } }))
        .status,
    ).toBe('EXPIRADA');
    expect(
      await prisma.lote.findUniqueOrThrow({ where: { id: v.lote.id } }),
    ).toMatchObject({ status: 'DISPONIVEL', teveReserva: true });
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: c.reserva.id } }))
        .status,
    ).toBe('ATIVA');
    const audit = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: { in: [v.reserva.id, v.lote.id] } },
    });
    expect(audit).toHaveLength(2);
    expect(audit.every((x) => x.usuarioId === null)).toBe(true);
    expect(await service.executar()).toEqual({ expiradas: 0, falhas: 0 });
    expect(app.get(SchedulerRegistry).getIntervals()).toContain(
      'expirar-reservas',
    );
  });
  it('duas instâncias não duplicam processamento nem auditoria', async () => {
    const v = await vencida();
    const r = await Promise.all([service.executar(), service.executar()]);
    expect(r.reduce((n, x) => n + x.expiradas, 0)).toBe(1);
    expect(
      await prisma.historicoAuditoria.count({
        where: { entidadeId: v.reserva.id, acao: 'EXPIRAR' },
      }),
    ).toBe(1);
  });
  it('falha da auditoria desfaz reserva e lote e não bloqueia próximas candidatas', async () => {
    const a = await vencida('Falhar'),
      b = await vencida('Passar');
    const audit = app.get(AuditoriaService);
    const original = audit.registrar.bind(audit);
    vi.spyOn(audit, 'registrar').mockImplementation((input, tx) => {
      if (input.entidadeId === a.reserva.id) throw new Error('falha simulada');
      return original(input, tx);
    });
    expect(await service.executar()).toEqual({ expiradas: 1, falhas: 1 });
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: a.reserva.id } }))
        .status,
    ).toBe('ATIVA');
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: a.lote.id } }))
        .status,
    ).toBe('RESERVADO');
    expect(
      await prisma.historicoAuditoria.count({
        where: { entidadeId: a.lote.id },
      }),
    ).toBe(0);
    expect(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: b.reserva.id } }))
        .status,
    ).toBe('EXPIRADA');
  });
  it('revalida prazo, aprovação e status depois da seleção inicial', async () => {
    const v = await vencida();
    // A consulta de candidatas não dá autorização de escrita: ela é refeita sob bloqueio.
    const { PrismaExpiracaoReservaRepository } =
      await import('../../src/modules/reservas/infra/repositories/prisma-expiracao-reserva.repository.js');
    const repo = new PrismaExpiracaoReservaRepository(prisma);
    const agora = new Date();
    expect(await repo.candidatas(agora)).toContain(v.reserva.id);
    await prisma.reserva.update({
      where: { id: v.reserva.id },
      data: { dataVencimento: new Date(Date.now() + 86400000) },
    });
    expect(
      await prisma.$transaction((tx) =>
        repo.travarVencida(v.reserva.id, agora, tx),
      ),
    ).toBeNull();
    await prisma.reserva.update({
      where: { id: v.reserva.id },
      data: {
        dataVencimento: new Date(Date.now() - 1000),
        status: 'CANCELADA',
      },
    });
    expect(
      await prisma.$transaction((tx) =>
        repo.travarVencida(v.reserva.id, agora, tx),
      ),
    ).toBeNull();
    await prisma.reserva.update({
      where: { id: v.reserva.id },
      data: { status: 'ATIVA' },
    });
    await prisma.proposta.create({
      data: {
        reservaId: v.reserva.id,
        vendedorId: c.usuarios.COMERCIAL.id,
        valor: '100.00',
        condicoes: 'Teste',
        status: 'APROVADA',
        prazoLimite: new Date(Date.now() + 86400000),
        decididoPorId: c.usuarios.GESTOR.id,
        dataDecisao: new Date(),
        motivoDecisao: 'Teste',
      },
    });
    expect(
      await prisma.$transaction((tx) =>
        repo.travarVencida(v.reserva.id, agora, tx),
      ),
    ).toBeNull();
  });
  it('percorre mais de um lote de candidatas sem limite de expirações por ciclo', async () => {
    const lotes = Array.from({ length: 101 }, (_, i) => ({
      id: randomUUID(),
      quadraId: c.quadras[0].id,
      numero: 'Batch' + i,
      areaM2: '100',
      status: 'RESERVADO' as const,
      teveReserva: true,
    }));
    await prisma.lote.createMany({ data: lotes });
    await prisma.reserva.createMany({
      data: lotes.map((lote) => ({
        loteId: lote.id,
        clienteId: c.cliente.id,
        vendedorId: c.usuarios.COMERCIAL.id,
        dataInicio: new Date(Date.now() - 86400000),
        dataVencimento: new Date(Date.now() - 1000),
      })),
    });
    expect(await service.executar()).toEqual({ expiradas: 101, falhas: 0 });
    expect(await prisma.reserva.count({ where: { status: 'EXPIRADA' } })).toBe(
      101,
    );
    expect(await service.executar()).toEqual({ expiradas: 0, falhas: 0 });
  });
  it('não sobrescreve lote vendido em inconsistência preexistente', async () => {
    const v = await vencida();
    await prisma.lote.update({
      where: { id: v.lote.id },
      data: { status: 'VENDIDO' },
    });
    expect(await service.executar()).toEqual({ expiradas: 0, falhas: 1 });
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: v.lote.id } }))
        .status,
    ).toBe('VENDIDO');
  });
});
