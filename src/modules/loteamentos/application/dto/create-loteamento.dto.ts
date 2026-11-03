import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class CreateLoteamentoDto {
  /**
   * Nome comercial, único entre os loteamentos
   * @example 'Residencial Bela Vista'
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  /** @example 'Loteamento residencial com 120 lotes' */
  @Trim({ vazioComoNulo: true })
  @IsOptional()
  @IsString()
  descricao?: string | null;

  /** @example 'Av. Parigot de Souza, Toledo - PR' */
  @Trim({ vazioComoNulo: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  localizacao?: string | null;
}
