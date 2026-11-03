import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Sessao } from '../models/sessao.entity.js';
export const SESSAO_REPOSITORY = Symbol('SESSAO_REPOSITORY');
export interface SessaoRepository {
  create(sessao: Sessao, tx: PrismaTransaction): Promise<void>;
  findValida(tokenHash: string): Promise<Sessao | null>;
  rotate(
    tokenHash: string,
    nova: Sessao,
    tx: PrismaTransaction,
  ): Promise<boolean>;
  revoke(tokenHash: string): Promise<void>;
}
