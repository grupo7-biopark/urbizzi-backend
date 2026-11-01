import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Usuario } from '../models/usuario.entity.js';
export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
export interface UsuarioRepository {
  redefinirSenha(
    id: string,
    senhaHash: string,
    tx: PrismaTransaction,
  ): Promise<boolean>;
  findById(id: string): Promise<Usuario | null>;
  findByEmail(email: string): Promise<Usuario | null>;
}
