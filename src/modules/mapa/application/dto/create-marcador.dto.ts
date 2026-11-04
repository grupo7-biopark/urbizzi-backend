import { IsNumber, Min, Max, IsUUID } from 'class-validator';
export class CoordenadasMarcadorDto {
  /** Coordenada horizontal normalizada. @example 0.5 */
  @IsNumber() @Min(0) @Max(1) x: number;
  /** Coordenada vertical normalizada. @example 0.5 */
  @IsNumber() @Min(0) @Max(1) y: number;
}
export class CreateMarcadorDto extends CoordenadasMarcadorDto {
  /** Lote a posicionar. @example '00000000-0000-4000-8000-000000000001' */
  @IsUUID() loteId: string;
}
