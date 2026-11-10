import { describe, expect, it } from 'vitest';
import { PainelPendenciasDto } from './painel-pendencias.dto.js';
import {
  PainelResumoDto,
  PainelResumoLoteamentoDto,
} from './painel-resumo.dto.js';
import { PainelVendasDto } from './painel-vendas.dto.js';

describe('Painel DTOs', () => {
  it('PainelResumoDto.from mapeia estrutura corretamente', () => {
    const raw = {
      geral: {
        total: 10,
        disponivel: 5,
        reservado: 2,
        vendido: 2,
        bloqueado: 1,
        porStatus: {
          DISPONIVEL: 5,
          RESERVADO: 2,
          VENDIDO: 2,
          BLOQUEADO: 1,
        },
      },
      porLoteamento: [
        {
          id: 'lot-1',
          loteamentoId: 'lot-1',
          nome: 'Loteamento 1',
          total: 10,
          disponivel: 5,
          reservado: 2,
          vendido: 2,
          bloqueado: 1,
          porStatus: {
            DISPONIVEL: 5,
            RESERVADO: 2,
            VENDIDO: 2,
            BLOQUEADO: 1,
          },
        },
      ],
      total: 10,
      disponivel: 5,
      reservado: 2,
      vendido: 2,
      bloqueado: 1,
      porStatus: {
        DISPONIVEL: 5,
        RESERVADO: 2,
        VENDIDO: 2,
        BLOQUEADO: 1,
      },
    };

    const dto = PainelResumoDto.from(raw);
    expect(dto.total).toBe(10);
    expect(dto.geral.disponivel).toBe(5);
    expect(dto.porLoteamento[0].loteamentoId).toBe('lot-1');
  });

  it('PainelResumoLoteamentoDto.from mapeia loteamento individual', () => {
    const rawItem = {
      id: 'lot-2',
      loteamentoId: 'lot-2',
      nome: 'Loteamento 2',
      total: 20,
      disponivel: 10,
      reservado: 4,
      vendido: 4,
      bloqueado: 2,
      porStatus: {
        DISPONIVEL: 10,
        RESERVADO: 4,
        VENDIDO: 4,
        BLOQUEADO: 2,
      },
    };

    const dto = PainelResumoLoteamentoDto.from(rawItem);
    expect(dto.id).toBe('lot-2');
    expect(dto.nome).toBe('Loteamento 2');
    expect(dto.disponivel).toBe(10);
  });

  it('PainelVendasDto.from mapeia vendas e séries temporais', () => {
    const rawVendas = {
      total: 3,
      valorTotal: '350000.00',
      periodo: { dia: 1, semana: 2, mes: 3 },
      resumo: { dia: 1, semana: 2, mes: 3 },
      porPeriodo: [
        { periodo: '2026-11-05', quantidade: 1, valorTotal: '100000.00' },
      ],
      porDia: [{ data: '2026-11-05', quantidade: 1, valorTotal: '100000.00' }],
      porSemana: [
        { semana: '2026-W45', quantidade: 2, valorTotal: '200000.00' },
      ],
      porMes: [{ mes: '2026-11', quantidade: 3, valorTotal: '350000.00' }],
      porVendedor: [
        {
          vendedorId: 'vend-1',
          nome: 'Vendedor Teste',
          quantidade: 3,
          valorTotal: '350000.00',
        },
      ],
    };

    const dto = PainelVendasDto.from(rawVendas);
    expect(dto.total).toBe(3);
    expect(dto.valorTotal).toBe('350000.00');
    expect(dto.periodo.dia).toBe(1);
    expect(dto.porVendedor[0].nome).toBe('Vendedor Teste');
  });

  it('PainelPendenciasDto.from mapeia indicadores de pendência', () => {
    const rawPendencias = {
      reservasAtivas: 15,
      reservasVencendoEmBreve: 5,
      propostasPendentes: 8,
      propostasAtrasadas: 2,
      total: 23,
      reservas: {
        ativas: 15,
        vencendoEmBreve: 5,
      },
      propostas: {
        pendentes: 8,
        atrasadas: 2,
        emDia: 6,
      },
    };

    const dto = PainelPendenciasDto.from(rawPendencias);
    expect(dto.reservasAtivas).toBe(15);
    expect(dto.reservasVencendoEmBreve).toBe(5);
    expect(dto.propostasPendentes).toBe(8);
    expect(dto.propostasAtrasadas).toBe(2);
    expect(dto.total).toBe(23);
    expect(dto.reservas.ativas).toBe(15);
    expect(dto.propostas.emDia).toBe(6);
  });
});
