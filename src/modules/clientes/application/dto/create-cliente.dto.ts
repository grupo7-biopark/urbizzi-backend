import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  documentoValido,
  normalizarDocumento,
} from '../../domain/models/documento.js';
@ValidatorConstraint({ name: 'documentoValido', async: false })
export class DocumentoValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && documentoValido(value);
  }
  defaultMessage(): string {
    return 'documento deve ser um CPF ou CNPJ válido';
  }
}
export class CreateClienteDto {
  /** @example 'Cliente Teste' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;
  /** CPF ou CNPJ numérico, com ou sem formatação. @example '52998224725' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarDocumento(value) : value,
  )
  @IsString()
  @Validate(DocumentoValidator)
  documento: string;
  /** @example '45999999999' */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string | null;
  /** @example 'cliente@exemplo.com' */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
  /** @example 'Contato comercial' */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  observacoes?: string | null;
}
