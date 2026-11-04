import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { CreateMarcadorDto } from './create-marcador.dto.js';
export class CreateMarcadoresDto {
  /** Marcadores criados atomicamente, até 500 por requisição. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateMarcadorDto)
  marcadores: CreateMarcadorDto[];
}
