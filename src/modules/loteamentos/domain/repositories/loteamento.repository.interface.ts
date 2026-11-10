import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Loteamento } from '../models/loteamento.entity.js';

export const LOTEAMENTO_REPOSITORY = Symbol('LOTEAMENTO_REPOSITORY');

export interface LoteamentoFiltros {
  q?: string;
}

export interface LoteamentoRepository {
  /** Bloqueia pais ativos em ordem de id até o commit e devolve os encontrados. */
  travarExistentes(ids: string[], tx: PrismaTransaction): Promise<string[]>;
  findById(id: string, tx?: PrismaTransaction): Promise<Loteamento | null>;
  /** Compara o nome sem diferenciar maiúsculas. */
  existsByNome(nome: string, ignoreId?: string): Promise<boolean>;
  /** Busca pelos nomes sem diferenciar maiúsculas. */
  findByNomes(nomes: string[], tx?: PrismaTransaction): Promise<Loteamento[]>;
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
