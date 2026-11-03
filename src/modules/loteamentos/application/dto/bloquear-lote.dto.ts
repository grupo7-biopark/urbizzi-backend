import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
export class BloquearLoteDto {
  /** Justificativa administrativa, sem dados pessoais. @example 'Lote indisponível para comercialização' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;
}
