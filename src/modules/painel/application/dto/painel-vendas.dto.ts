import { ApiProperty } from '@nestjs/swagger';
import type { PainelVendas } from '../../domain/repositories/painel-consulta.repository.interface.js';

export class PainelVendasPeriodoTotaisDto {
  /** Total de vendas no dia de hoje (ou no dia). @example 2 */
  @ApiProperty({ example: 2 })
  dia: number;

  /** Total de vendas na semana. @example 5 */
  @ApiProperty({ example: 5 })
  semana: number;

  /** Total de vendas no mês. @example 12 */
  @ApiProperty({ example: 12 })
  mes: number;
}

export class PainelVendaPeriodoItemDto {
  /** Identificador do período (dia, semana ou mês). @example '2026-11-01' */
  @ApiProperty({ example: '2026-11-01' })
  periodo: string;

  /** Quantidade de vendas no período. @example 2 */
  @ApiProperty({ example: 2 })
  quantidade: number;

  /** Valor total vendido no período. @example '300000.00' */
  @ApiProperty({ example: '300000.00' })
  valorTotal: string;
}

export class PainelVendaDiaItemDto {
  /** Data da venda (YYYY-MM-DD). @example '2026-11-05' */
  @ApiProperty({ example: '2026-11-05' })
  data: string;

  /** Quantidade de vendas na data. @example 1 */
  @ApiProperty({ example: 1 })
  quantidade: number;

  /** Valor total vendido na data. @example '150000.00' */
  @ApiProperty({ example: '150000.00' })
  valorTotal: string;
}

export class PainelVendaSemanaItemDto {
  /** Semana da venda (YYYY-Www). @example '2026-W45' */
  @ApiProperty({ example: '2026-W45' })
  semana: string;

  /** Quantidade de vendas na semana. @example 4 */
  @ApiProperty({ example: 4 })
  quantidade: number;

  /** Valor total vendido na semana. @example '600000.00' */
  @ApiProperty({ example: '600000.00' })
  valorTotal: string;
}

export class PainelVendaMesItemDto {
  /** Mês da venda (YYYY-MM). @example '2026-11' */
  @ApiProperty({ example: '2026-11' })
  mes: string;

  /** Quantidade de vendas no mês. @example 10 */
  @ApiProperty({ example: 10 })
  quantidade: number;

  /** Valor total vendido no mês. @example '1500000.00' */
  @ApiProperty({ example: '1500000.00' })
  valorTotal: string;
}

export class PainelVendaVendedorItemDto {
  /** Identificador do vendedor. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  vendedorId: string;

  /** Nome do vendedor. @example 'Carlos Vendedor' */
  @ApiProperty({ example: 'Carlos Vendedor' })
  nome: string;

  /** Quantidade de vendas efetuadas pelo vendedor. @example 5 */
  @ApiProperty({ example: 5 })
  quantidade: number;

  /** Valor total vendido pelo vendedor. @example '750000.00' */
  @ApiProperty({ example: '750000.00' })
  valorTotal: string;
}

export class PainelVendasDto {
  /** Quantidade total de vendas no filtro. @example 12 */
  @ApiProperty({ example: 12 })
  total: number;

  /** Valor total das vendas no filtro. @example '1800000.00' */
  @ApiProperty({ example: '1800000.00' })
  valorTotal: string;

  /** Vendas agregadas por períodos de referência (dia, semana, mês). */
  @ApiProperty({ type: PainelVendasPeriodoTotaisDto })
  periodo: PainelVendasPeriodoTotaisDto;

  /** Resumo de vendas por período (alias para periodo). */
  @ApiProperty({ type: PainelVendasPeriodoTotaisDto })
  resumo: PainelVendasPeriodoTotaisDto;

  /** Série temporal de vendas pelo agrupamento selecionado. */
  @ApiProperty({ type: [PainelVendaPeriodoItemDto] })
  porPeriodo: PainelVendaPeriodoItemDto[];

  /** Vendas agrupadas por dia. */
  @ApiProperty({ type: [PainelVendaDiaItemDto] })
  porDia: PainelVendaDiaItemDto[];

  /** Vendas agrupadas por semana. */
  @ApiProperty({ type: [PainelVendaSemanaItemDto] })
  porSemana: PainelVendaSemanaItemDto[];

  /** Vendas agrupadas por mês. */
  @ApiProperty({ type: [PainelVendaMesItemDto] })
  porMes: PainelVendaMesItemDto[];

  /** Vendas agrupadas por vendedor. */
  @ApiProperty({ type: [PainelVendaVendedorItemDto] })
  porVendedor: PainelVendaVendedorItemDto[];

  static from(data: PainelVendas): PainelVendasDto {
    return {
      total: data.total,
      valorTotal: data.valorTotal,
      periodo: {
        dia: data.periodo.dia,
        semana: data.periodo.semana,
        mes: data.periodo.mes,
      },
      resumo: {
        dia: data.resumo.dia,
        semana: data.resumo.semana,
        mes: data.resumo.mes,
      },
      porPeriodo: data.porPeriodo,
      porDia: data.porDia,
      porSemana: data.porSemana,
      porMes: data.porMes,
      porVendedor: data.porVendedor,
    };
  }
}
