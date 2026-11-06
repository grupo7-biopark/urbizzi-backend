import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class PainelPendenciasQueryDto {
  /** Identificador do loteamento para filtro. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
  @IsOptional()
  @IsUUID()
  loteamentoId?: string;

  /** Identificador do vendedor para filtro (gestor/admin); comercial é limitado ao próprio usuário. @example '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' */
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

  /** Quantidade de dias para considerar vencimento em breve (padrão: 3). @example 3 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diasVencimentoEmBreve?: number;
}
