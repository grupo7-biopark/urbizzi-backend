import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
export class ResetPasswordDto {
  /** Token recebido por e-mail. @example 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;
  /** Nova senha, com no mínimo 8 caracteres. @example 'NovaSenha123!' */
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  senha: string;
}
