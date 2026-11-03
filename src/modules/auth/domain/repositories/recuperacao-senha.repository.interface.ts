import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { TokenRecuperacaoSenha } from '../models/token-recuperacao-senha.entity.js';
export const RECUPERACAO_SENHA_REPOSITORY = Symbol(
  'RECUPERACAO_SENHA_REPOSITORY',
);
export interface RecuperacaoSenhaRepository {
  create(token: TokenRecuperacaoSenha): Promise<void>;
  findByHash(
    hash: string,
    tx: PrismaTransaction,
  ): Promise<TokenRecuperacaoSenha | null>;
  consumir(hash: string, tx: PrismaTransaction): Promise<boolean>;
  invalidarTodos(usuarioId: string, tx: PrismaTransaction): Promise<void>;
}
