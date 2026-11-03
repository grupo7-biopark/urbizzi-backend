import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

/** Parâmetros de rota de um tile: `/plantas/:id/tiles/:z/:x/:y.webp`. */
export class TileParamsDto {
  @IsUUID()
  id: string;

  /** Nível de zoom (0 = imagem inteira em um tile) */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  z: number;

  /** Coluna do tile no nível, a partir de 0 */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  x: number;

  /** Linha do tile no nível, a partir de 0 */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  y: number;
}
