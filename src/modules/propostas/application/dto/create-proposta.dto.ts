import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';
import { DecimalPositivo } from '../../../../shared/application/dto/decimal-positivo.validator.js';
export class CreatePropostaDto {
  /** Valor proposto, com até 2 casas decimais. @example '250000.00' */
  @DecimalPositivo(12) valor: string;
  /** Condições de pagamento. @example 'Pagamento à vista' */
  @Trim() @IsString() @MinLength(1) @MaxLength(10000) condicoes: string;
  /** Observações opcionais. @example 'Sujeito à análise do gestor' */
  @Trim({ vazioComoNulo: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  observacoes?: string | null;
}
