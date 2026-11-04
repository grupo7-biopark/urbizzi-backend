import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PerfilCodigo } from '../../../../generated/prisma/client.js';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';
export class CreateUsuarioDto {
  /** Nome do usuário. @example 'Maria Silva' */
  @Trim() @IsString() @MinLength(1) @MaxLength(150) @Matches(/\S/) nome: string;
  /** E-mail único. @example 'maria@exemplo.com' */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
  /** Perfil de acesso. @example 'COMERCIAL' */
  @ApiProperty({ enum: PerfilCodigo, enumName: 'PerfilCodigo' })
  @IsEnum(PerfilCodigo)
  perfil: PerfilCodigo;
  /** Senha inicial. @example 'SenhaInicial123!' */
  @IsString() @MinLength(8) @MaxLength(1024) senha: string;
}
