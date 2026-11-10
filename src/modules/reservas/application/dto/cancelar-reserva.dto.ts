import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class CancelarReservaDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @ValidateIf((_obj, valor: unknown) => valor !== undefined)
  @IsBoolean()
  confirmar?: boolean;
}
