import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Loteamento } from '../models/loteamento.entity.js';

export const LOTEAMENTO_REPOSITORY = Symbol('LOTEAMENTO_REPOSITORY');

export interface LoteamentoFiltros {
  q?: string;
}

export interface LoteamentoRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Loteamento | null>;
  /** Compara o nome sem diferenciar maiúsculas. */
  existsByNome(nome: string, ignoreId?: string): Promise<boolean>;
  /** Indica se o loteamento tem quadras não excluídas. */
  hasQuadras(id: string, tx?: PrismaTransaction): Promise<boolean>;
  list(
    filtros: LoteamentoFiltros,
    pagination: Pagination,
  ): Promise<Page<Loteamento>>;
  create(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void>;
  update(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void>;
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
