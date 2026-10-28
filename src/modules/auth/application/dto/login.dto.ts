import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
export class LoginDto {
  /** E-mail cadastrado. @example 'usuario@exemplo.com' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
  /** Senha do usuário. @example 'SenhaExemplo123!' */
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  senha: string;
}
