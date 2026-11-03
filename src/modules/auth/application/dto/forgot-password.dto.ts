import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
export class ForgotPasswordDto {
  /** E-mail cadastrado. @example 'usuario@exemplo.com' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}
