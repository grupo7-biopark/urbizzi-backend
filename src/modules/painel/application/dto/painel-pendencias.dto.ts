import { ApiProperty } from '@nestjs/swagger';
import type { PainelPendencias } from '../../domain/repositories/painel-consulta.repository.interface.js';

export class PendenciasReservasDto {
  /** Quantidade de reservas ativas. @example 8 */
  @ApiProperty({ example: 8 })
  ativas: number;

  /** Quantidade de reservas ativas com vencimento em breve. @example 2 */
  @ApiProperty({ example: 2 })
  vencendoEmBreve: number;
}

export class PendenciasPropostasDto {
  /** Quantidade de propostas em análise (pendentes de decisão). @example 5 */
  @ApiProperty({ example: 5 })
  pendentes: number;

  /** Quantidade de propostas em análise com prazo limite ultrapassado. @example 1 */
  @ApiProperty({ example: 1 })
  atrasadas: number;

  /** Quantidade de propostas em análise dentro do prazo limite. @example 4 */
  @ApiProperty({ example: 4 })
  emDia: number;
}

export class PainelPendenciasDto {
  /** Quantidade de reservas ativas. @example 8 */
  @ApiProperty({ example: 8 })
  reservasAtivas: number;

  /** Quantidade de reservas com vencimento em breve. @example 2 */
  @ApiProperty({ example: 2 })
  reservasVencendoEmBreve: number;

  /** Quantidade de propostas pendentes em análise. @example 5 */
  @ApiProperty({ example: 5 })
  propostasPendentes: number;

  /** Quantidade de propostas atrasadas. @example 1 */
  @ApiProperty({ example: 1 })
  propostasAtrasadas: number;

  /** Total de itens pendentes (reservas ativas + propostas pendentes). @example 13 */
  @ApiProperty({ example: 13 })
  total: number;

  /** Detalhe de pendências de reservas. */
  @ApiProperty({ type: PendenciasReservasDto })
  reservas: PendenciasReservasDto;

  /** Detalhe de pendências de propostas. */
  @ApiProperty({ type: PendenciasPropostasDto })
  propostas: PendenciasPropostasDto;

  static from(data: PainelPendencias): PainelPendenciasDto {
    return {
      reservasAtivas: data.reservasAtivas,
      reservasVencendoEmBreve: data.reservasVencendoEmBreve,
      propostasPendentes: data.propostasPendentes,
      propostasAtrasadas: data.propostasAtrasadas,
      total: data.total,
      reservas: data.reservas,
      propostas: data.propostas,
    };
  }
}
