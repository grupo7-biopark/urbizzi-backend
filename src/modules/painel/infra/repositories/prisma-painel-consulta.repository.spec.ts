import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import { PrismaPainelConsultaRepository } from './prisma-painel-consulta.repository.js';

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

  it('agrega vendas por período (dia, semana, mês) e vendedor', async () => {
    const agora = new Date();
    const dataHoje = new Date(agora);
    const dataSemana = new Date(agora.getTime() - 2 * 86400000);
    const dataMes = new Date(agora.getTime() - 15 * 86400000);

    const mockVendas = [
      {
        reservaId: 'res-1',
        vendedorId: 'vend-1',
        vendedorNome: 'Vendedor Um',
        dataVenda: dataHoje,
        valor: '100000.50',
        loteamentoId: 'lot-1',
      },
      {
        reservaId: 'res-2',
        vendedorId: 'vend-1',
        vendedorNome: 'Vendedor Um',
        dataVenda: dataSemana,
        valor: '200000.50',
        loteamentoId: 'lot-1',
      },
      {
        reservaId: 'res-3',
        vendedorId: 'vend-2',
        vendedorNome: 'Vendedor Dois',
        dataVenda: dataMes,
        valor: '150000.00',
        loteamentoId: 'lot-2',
      },
    ];

    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue(mockVendas),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);

    const resultadoDia = await repository.obterVendas({ agrupamento: 'dia' });
    expect(resultadoDia.total).toBe(3);
    expect(resultadoDia.valorTotal).toBe('450001.00');
    expect(resultadoDia.porVendedor).toHaveLength(2);
    expect(resultadoDia.porVendedor[0].vendedorId).toBe('vend-1');
    expect(resultadoDia.porVendedor[0].quantidade).toBe(2);
    expect(resultadoDia.porVendedor[0].valorTotal).toBe('300001.00');
    expect(resultadoDia.porPeriodo.length).toBeGreaterThan(0);

    const resultadoSemana = await repository.obterVendas({
      agrupamento: 'semana',
    });
    expect(resultadoSemana.porPeriodo[0]).toHaveProperty('periodo');

    const resultadoMes = await repository.obterVendas({ agrupamento: 'mes' });
    expect(resultadoMes.porPeriodo[0]).toHaveProperty('periodo');
  });

  it('agrega pendências de reservas ativas, vencendo em breve e propostas atrasadas', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ ativas: 12, vencendoEmBreve: 4 }])
        .mockResolvedValueOnce([{ pendentes: 6, atrasadas: 2, emDia: 4 }]),
    } as unknown as PrismaService;

    const repository = new PrismaPainelConsultaRepository(prisma);
    const resultado = await repository.obterPendencias({
      limiteBreve: new Date(Date.now() + 3 * 86400000),
    });

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
