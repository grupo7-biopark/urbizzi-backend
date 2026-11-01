import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Usuario } from '../models/usuario.entity.js';
export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
export interface UsuarioRepository {
  redefinirSenha(
    id: string,
    senhaHash: string,
    tx: PrismaTransaction,
  ): Promise<boolean>;
  bloquearAutenticacao(id: string, tx: PrismaTransaction): Promise<void>;
  bloquearAutenticacaoPorEmail(
    email: string,
    tx: PrismaTransaction,
  ): Promise<void>;
  findById(id: string, tx?: PrismaTransaction): Promise<Usuario | null>;
  findByEmail(email: string, tx?: PrismaTransaction): Promise<Usuario | null>;
}
