import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DecimalPositivo } from '../../../../shared/application/dto/decimal-positivo.validator.js';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class CreateLoteDto {
  /** @example '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10' */
  @IsUUID()
  quadraId: string;

  /**
   * Número do lote, único na quadra
   * @example '12'
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;

  /**
   * Área em m², positiva, com até 2 casas decimais
   * @example '360.00'
   */
  @DecimalPositivo(10)
  areaM2: string;

  /**
   * Valor de venda, positivo, com até 2 casas decimais; `null` se ainda não definido
   * @example '250000.00'
   */
  @IsOptional()
  @DecimalPositivo(12)
  valor?: string | null;

  /**
   * Exibe o valor no link público (padrão `false`)
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  exibirValorPublico?: boolean;

  /** @example 'Lote de esquina' */
  @Trim({ vazioComoNulo: true })
  @IsOptional()
  @IsString()
  observacoes?: string | null;
}
