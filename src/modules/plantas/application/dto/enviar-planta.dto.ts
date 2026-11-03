import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

/** Campos de texto do multipart de envio da planta. */
export class EnviarPlantaDto {
  /**
   * Nome para identificar a planta
   * @example 'Masterplan Biopark 2026'
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;
}
