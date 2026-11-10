import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class DecidirPropostaDto {
  /** Motivo da decisão (aprovação ou rejeição). @example 'Proposta aprovada conforme negociação comercial' */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  motivo: string;
}
