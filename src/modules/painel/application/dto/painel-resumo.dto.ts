import { ApiProperty } from '@nestjs/swagger';
import type {
  PainelResumo,
  PainelResumoLoteamento,
} from '../../domain/repositories/painel-consulta.repository.interface.js';

export class ContagemStatusLoteDto {
  /** Quantidade de lotes disponíveis. @example 50 */
  @ApiProperty({ example: 50 })
  DISPONIVEL: number;

  /** Quantidade de lotes reservados. @example 20 */
  @ApiProperty({ example: 20 })
  RESERVADO: number;

  /** Quantidade de lotes vendidos. @example 25 */
  @ApiProperty({ example: 25 })
  VENDIDO: number;

  /** Quantidade de lotes bloqueados. @example 5 */
  @ApiProperty({ example: 5 })
  BLOQUEADO: number;
}

export class PainelResumoItemDto {
  /** Total de lotes. @example 100 */
  @ApiProperty({ example: 100 })
  total: number;

  /** Lotes disponíveis. @example 50 */
  @ApiProperty({ example: 50 })
  disponivel: number;

  /** Lotes reservados. @example 20 */
  @ApiProperty({ example: 20 })
  reservado: number;

  /** Lotes vendidos. @example 25 */
  @ApiProperty({ example: 25 })
  vendido: number;

  /** Lotes bloqueados. @example 5 */
  @ApiProperty({ example: 5 })
  bloqueado: number;

  /** Contagem por status do lote. */
  @ApiProperty({ type: ContagemStatusLoteDto })
  porStatus: ContagemStatusLoteDto;
}

export class PainelResumoLoteamentoDto extends PainelResumoItemDto {
  /** Identificador do loteamento. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  /** Identificador do loteamento (alias). @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  loteamentoId: string;

  /** Nome do loteamento. @example 'Residencial Sul' */
  @ApiProperty({ example: 'Residencial Sul' })
  nome: string;

  static from(item: PainelResumoLoteamento): PainelResumoLoteamentoDto {
    return {
      id: item.id,
      loteamentoId: item.loteamentoId,
      nome: item.nome,
      total: item.total,
      disponivel: item.disponivel,
      reservado: item.reservado,
      vendido: item.vendido,
      bloqueado: item.bloqueado,
      porStatus: item.porStatus,
    };
  }
}

export class PainelResumoDto {
  /** Resumo geral de todos os lotes. */
  @ApiProperty({ type: PainelResumoItemDto })
  geral: PainelResumoItemDto;

  /** Resumo por loteamento. */
  @ApiProperty({ type: [PainelResumoLoteamentoDto] })
  porLoteamento: PainelResumoLoteamentoDto[];

  /** Total geral de lotes. @example 100 */
  @ApiProperty({ example: 100 })
  total: number;

  /** Total geral de lotes disponíveis. @example 50 */
  @ApiProperty({ example: 50 })
  disponivel: number;

  /** Total geral de lotes reservados. @example 20 */
  @ApiProperty({ example: 20 })
  reservado: number;

  /** Total geral de lotes vendidos. @example 25 */
  @ApiProperty({ example: 25 })
  vendido: number;

  /** Total geral de lotes bloqueados. @example 5 */
  @ApiProperty({ example: 5 })
  bloqueado: number;

  /** Contagem geral por status do lote. */
  @ApiProperty({ type: ContagemStatusLoteDto })
  porStatus: ContagemStatusLoteDto;

  static from(data: PainelResumo): PainelResumoDto {
    return {
      geral: {
        total: data.geral.total,
        disponivel: data.geral.disponivel,
        reservado: data.geral.reservado,
        vendido: data.geral.vendido,
        bloqueado: data.geral.bloqueado,
        porStatus: data.geral.porStatus,
      },
      porLoteamento: data.porLoteamento.map(PainelResumoLoteamentoDto.from),
      total: data.total,
      disponivel: data.disponivel,
      reservado: data.reservado,
      vendido: data.vendido,
      bloqueado: data.bloqueado,
      porStatus: data.porStatus,
    };
  }
}
