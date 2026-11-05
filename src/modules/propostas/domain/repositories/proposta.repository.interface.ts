import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Pagination, Page } from '../../../../shared/domain/pagination.js';
import type { Proposta } from '../models/proposta.entity.js';
export const PROPOSTA_REPOSITORY = Symbol('PROPOSTA_REPOSITORY');
export interface PropostaRepository {
  create(proposta: Proposta, tx: PrismaTransaction): Promise<void>;
  findById(id: string): Promise<Proposta | null>;
  findImpedimento(
    reservaId: string,
    tx: PrismaTransaction,
  ): Promise<'EM_ANALISE' | 'APROVADA' | null>;
  list(reservaId: string, query: Pagination): Promise<Page<Proposta>>;
}
