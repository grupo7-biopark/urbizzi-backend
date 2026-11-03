import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class CreateQuadraDto {
  /**
   * Identificação da quadra, única no loteamento
   * @example 'A'
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;
}
