import { ApiProperty } from '@nestjs/swagger';
import { PerfilCodigo } from '../../../../generated/prisma/client.js';
import type { Usuario } from '../../domain/models/usuario.entity.js';
export class UsuarioDto {
  id: string;
  nome: string;
  email: string;
  @ApiProperty({ enum: PerfilCodigo, enumName: 'PerfilCodigo' })
  perfil: PerfilCodigo;
  ativo: boolean;
  static from(usuario: Usuario): UsuarioDto {
    return { ...usuario.dados, ativo: usuario.ativo };
  }
}
