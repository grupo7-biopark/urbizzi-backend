import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import {
  formatISOWeek,
  PrismaPainelConsultaRepository,
} from './prisma-painel-consulta.repository.js';

const transacaoMock = () =>
  vi.fn((consultas: Promise<unknown>[]) => Promise.all(consultas));

describe('formatISOWeek', () => {
  it('calcula ano e semana ISO corretos nas viradas de dezembro e janeiro (regressão)', () => {
    // 2019-12-30 é segunda-feira da semana 01 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2019, 11, 30)))).toBe('2020-W01');
    // 2019-12-31 é terça-feira da semana 01 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2019, 11, 31)))).toBe('2020-W01');
    // 2020-01-01 é quarta-feira da semana 01 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2020, 0, 1)))).toBe('2020-W01');

    // 2020-12-31 é quinta-feira da semana 53 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2020, 11, 31)))).toBe('2020-W53');
    // 2021-01-01 é sexta-feira da semana 53 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2021, 0, 1)))).toBe('2020-W53');
    // 2021-01-02 é sábado da semana 53 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2021, 0, 2)))).toBe('2020-W53');
    // 2021-01-03 é domingo da semana 53 de 2020
    expect(formatISOWeek(new Date(Date.UTC(2021, 0, 3)))).toBe('2020-W53');

    // 2021-01-04 é segunda-feira da semana 01 de 2021
    expect(formatISOWeek(new Date(Date.UTC(2021, 0, 4)))).toBe('2021-W01');
  });

  it('método da classe delega para a função pura formatISOWeek', () => {
    const repo = new PrismaPainelConsultaRepository({} as PrismaService);
    expect(repo.formatISOWeek(new Date(Date.UTC(2019, 11, 30)))).toBe(
      '2020-W01',
    );
    expect(repo.formatISOWeek(new Date(Date.UTC(2021, 0, 1)))).toBe('2020-W53');
  });
});

describe('PrismaPainelConsultaRepository', () => {
  it('agrega resumo de lotes geral e por loteamento corretamente', async () => {
    const mockRows = [
      {
        loteamentoId: 'lot-1',
        loteamentoNome: 'Loteamento Norte',
        status: 'DISPONIVEL' as const,
        quantidade: 10,
      },
      {
        loteamentoId: 'lot-1',
        loteamentoNome: 'Loteamento Norte',
        status: 'RESERVADO' as const,
        quantidade: 5,
      },
      {
        loteamentoId: 'lot-1',
        loteamentoNome: 'Loteamento Norte',
        status: 'VENDIDO' as const,
        quantidade: 3,
      },
      {
        loteamentoId: 'lot-1',
        loteamentoNome: 'Loteamento Norte',
        status: 'BLOQUEADO' as const,
        quantidade: 2,
      },
      {
        loteamentoId: 'lot-2',
        loteamentoNome: 'Loteamento Sul',
        status: 'DISPONIVEL' as const,
        quantidade: 15,
      },
    ];

    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue(mockRows),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);
    const resultado = await repository.obterResumo({});

    expect(resultado.total).toBe(35);
    expect(resultado.disponivel).toBe(25);
    expect(resultado.reservado).toBe(5);
    expect(resultado.vendido).toBe(3);
    expect(resultado.bloqueado).toBe(2);
    expect(resultado.porLoteamento).toHaveLength(2);
    expect(resultado.porLoteamento[0].id).toBe('lot-1');
    expect(resultado.porLoteamento[0].total).toBe(20);
    expect(resultado.porLoteamento[1].id).toBe('lot-2');
    expect(resultado.porLoteamento[1].total).toBe(15);
  });

  it('agrega vendas no banco via COUNT/SUM/GROUP BY para dia, semana, mês e vendedor', async () => {
    const mockTotais = [
      {
        total: 3,
        valorTotal: '450001.00',
        vendasHoje: 1,
        vendasSemana: 2,
        vendasMes: 3,
      },
    ];
    const mockPorDia = [
      { data: '2026-11-09', quantidade: 1, valorTotal: '100000.50' },
      { data: '2026-11-07', quantidade: 1, valorTotal: '200000.50' },
      { data: '2026-10-25', quantidade: 1, valorTotal: '150000.00' },
    ];
    const mockPorSemana = [
      { semana: '2026-W46', quantidade: 2, valorTotal: '300001.00' },
      { semana: '2026-W43', quantidade: 1, valorTotal: '150000.00' },
    ];
    const mockPorMes = [
      { mes: '2026-11', quantidade: 2, valorTotal: '300001.00' },
      { mes: '2026-10', quantidade: 1, valorTotal: '150000.00' },
    ];
    const mockPorVendedor = [
      {
        vendedorId: 'vend-1',
        nome: 'Vendedor Um',
        quantidade: 2,
        valorTotal: '300001.00',
      },
      {
        vendedorId: 'vend-2',
        nome: 'Vendedor Dois',
        quantidade: 1,
        valorTotal: '150000.00',
      },
    ];

    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(mockTotais)
        .mockResolvedValueOnce(mockPorDia)
        .mockResolvedValueOnce(mockPorSemana)
        .mockResolvedValueOnce(mockPorMes)
        .mockResolvedValueOnce(mockPorVendedor),
      $transaction: transacaoMock(),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);

    const resultadoDia = await repository.obterVendas({ agrupamento: 'dia' });
    expect(prisma.$transaction).toHaveBeenCalledExactlyOnceWith(
      Array.from({ length: 5 }, () => expect.any(Promise)),
      { isolationLevel: 'RepeatableRead' },
    );
    expect(resultadoDia.total).toBe(3);
    expect(resultadoDia.valorTotal).toBe('450001.00');
    expect(resultadoDia.periodo.dia).toBe(1);
    expect(resultadoDia.periodo.semana).toBe(2);
    expect(resultadoDia.periodo.mes).toBe(3);
    expect(resultadoDia.porPeriodo).toHaveLength(3);
    expect(resultadoDia.porPeriodo[0]).toEqual({
      periodo: '2026-11-09',
      quantidade: 1,
      valorTotal: '100000.50',
    });
    expect(resultadoDia.porDia).toEqual(mockPorDia);
    expect(resultadoDia.porSemana).toEqual(mockPorSemana);
    expect(resultadoDia.porMes).toEqual(mockPorMes);
    expect(resultadoDia.porVendedor).toEqual(mockPorVendedor);
  });

  it('mapeia porPeriodo e porSemana corretamente na virada de ano (dezembro/janeiro)', async () => {
    const mockTotais = [
      {
        total: 2,
        valorTotal: '300000.00',
        vendasHoje: 0,
        vendasSemana: 1,
        vendasMes: 1,
      },
    ];
    const mockPorDia = [
      { data: '2021-01-01', quantidade: 1, valorTotal: '150000.00' },
      { data: '2019-12-30', quantidade: 1, valorTotal: '150000.00' },
    ];
    // Ambas as semanas pertencem a semanas ISO da virada: 2020-W53 e 2020-W01
    const mockPorSemanaVirada = [
      { semana: '2020-W53', quantidade: 1, valorTotal: '150000.00' },
      { semana: '2020-W01', quantidade: 1, valorTotal: '150000.00' },
    ];
    const mockPorMes = [
      { mes: '2021-01', quantidade: 1, valorTotal: '150000.00' },
      { mes: '2019-12', quantidade: 1, valorTotal: '150000.00' },
    ];
    const mockPorVendedor = [
      {
        vendedorId: 'vend-1',
        nome: 'Vendedor Um',
        quantidade: 2,
        valorTotal: '300000.00',
      },
    ];

    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce(mockTotais)
        .mockResolvedValueOnce(mockPorDia)
        .mockResolvedValueOnce(mockPorSemanaVirada)
        .mockResolvedValueOnce(mockPorMes)
        .mockResolvedValueOnce(mockPorVendedor),
      $transaction: transacaoMock(),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);

    const resultadoSemana = await repository.obterVendas({
      agrupamento: 'semana',
    });

    // Confere porSemana com as semanas ISO corretas
    expect(resultadoSemana.porSemana[0].semana).toBe('2020-W53');
    expect(resultadoSemana.porSemana[1].semana).toBe('2020-W01');

    // Confere porPeriodo quando agrupamento é semana
    expect(resultadoSemana.porPeriodo).toEqual([
      { periodo: '2020-W53', quantidade: 1, valorTotal: '150000.00' },
      { periodo: '2020-W01', quantidade: 1, valorTotal: '150000.00' },
    ]);
  });

  it('retorna valores zerados quando não há vendas', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      $transaction: transacaoMock(),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);
    const resultado = await repository.obterVendas({ agrupamento: 'mes' });

    expect(resultado.total).toBe(0);
    expect(resultado.valorTotal).toBe('0.00');
    expect(resultado.periodo).toEqual({ dia: 0, semana: 0, mes: 0 });
    expect(resultado.porPeriodo).toEqual([]);
    expect(resultado.porDia).toEqual([]);
    expect(resultado.porSemana).toEqual([]);
    expect(resultado.porMes).toEqual([]);
    expect(resultado.porVendedor).toEqual([]);
  });

  it('agrega pendências de reservas ativas, vencendo em breve e propostas atrasadas', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ ativas: 12, vencendoEmBreve: 4 }])
        .mockResolvedValueOnce([{ pendentes: 6, atrasadas: 2, emDia: 4 }]),
      $transaction: transacaoMock(),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);
    const resultado = await repository.obterPendencias({
      limiteBreve: new Date(Date.now() + 3 * 86400000),
    });
    expect(prisma.$transaction).toHaveBeenCalledExactlyOnceWith(
      [expect.any(Promise), expect.any(Promise)],
      { isolationLevel: 'RepeatableRead' },
    );

    expect(resultado.reservasAtivas).toBe(12);
    expect(resultado.reservasVencendoEmBreve).toBe(4);
    expect(resultado.propostasPendentes).toBe(6);
    expect(resultado.propostasAtrasadas).toBe(2);
    expect(resultado.total).toBe(18);
    expect(resultado.reservas.ativas).toBe(12);
    expect(resultado.reservas.vencendoEmBreve).toBe(4);
    expect(resultado.propostas.pendentes).toBe(6);
    expect(resultado.propostas.atrasadas).toBe(2);
    expect(resultado.propostas.emDia).toBe(4);
  });
});
