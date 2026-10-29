import { ApiProperty } from '@nestjs/swagger';
import { PerfilCodigo } from '../../../../generated/prisma/client.js';
export class UsuarioLogadoDto {
  /** Identificador do usuário. @example 'e0ed7a15-2f1c-473f-b9c6-b426818598cd' */
  id: string;
  /** Nome do usuário. @example 'Usuário Teste' */
  nome: string;
  /** E-mail do próprio usuário. @example 'usuario@exemplo.com' */
  email: string;
  /** Perfil atual. @example 'COMERCIAL' */
  @ApiProperty({ enum: PerfilCodigo, enumName: 'PerfilCodigo' })
  perfil: PerfilCodigo;
}
