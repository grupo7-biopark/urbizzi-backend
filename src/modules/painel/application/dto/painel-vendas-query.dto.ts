import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class PainelVendasQueryDto {
  /** Identificador do loteamento para filtro. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @IsOptional()
  @IsUUID()
  loteamentoId?: string;

  /** Identificador do vendedor para filtro. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  /** Data inicial do período em UTC (YYYY-MM-DD ou ISO 8601). @example '2026-11-01' */
  @IsOptional()
  @IsDateString({ strict: true })
  dataDe?: string;

  /** Data final do período em UTC (YYYY-MM-DD ou ISO 8601). @example '2026-11-30' */
  @IsOptional()
  @IsDateString({ strict: true })
  dataAte?: string;

  /** Agrupamento desejado para a série de vendas ('dia', 'semana', 'mes'). @example 'dia' */
  @IsOptional()
  @IsIn(['dia', 'semana', 'mes'])
  agrupamento?: 'dia' | 'semana' | 'mes';
}
