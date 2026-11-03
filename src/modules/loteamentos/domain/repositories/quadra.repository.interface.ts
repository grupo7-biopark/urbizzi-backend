import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Quadra } from '../models/quadra.entity.js';

export const QUADRA_REPOSITORY = Symbol('QUADRA_REPOSITORY');

export interface QuadraFiltros {
  loteamentoId: string;
  q?: string;
}

export interface QuadraRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Quadra | null>;
  /** Compara o número dentro do loteamento sem diferenciar maiúsculas. */
  existsByNumero(
    loteamentoId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<boolean>;
  /** Indica se a quadra tem lotes não excluídos. */
  hasLotes(id: string, tx?: PrismaTransaction): Promise<boolean>;
  list(filtros: QuadraFiltros, pagination: Pagination): Promise<Page<Quadra>>;
  create(quadra: Quadra, tx?: PrismaTransaction): Promise<void>;
  update(quadra: Quadra, tx?: PrismaTransaction): Promise<void>;
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
