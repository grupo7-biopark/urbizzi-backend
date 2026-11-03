import { IsInt, Min, Max, ValidateIf } from 'class-validator';
export class UpdateConfiguracoesDto {
  /** Prazo aplicado a novas reservas. @example 7 */
  @ValidateIf((_obj, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  prazoReservaDias?: number;
  /** Prazo aplicado a novas propostas. @example 7 */
  @ValidateIf((_obj, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  prazoAnaliseDiasUteis?: number;
}
