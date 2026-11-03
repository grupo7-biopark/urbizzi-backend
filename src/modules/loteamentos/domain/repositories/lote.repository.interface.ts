import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Lote, StatusLote } from '../models/lote.entity.js';

export const LOTE_REPOSITORY = Symbol('LOTE_REPOSITORY');

/** Filtros combináveis (todos em conjunto). */
export interface LoteFiltros {
  loteamentoId?: string;
  quadraId?: string;
  status?: StatusLote[];
  /** Parte do número, sem diferenciar maiúsculas. */
  q?: string;
}

export interface LoteRepository {
  alterarStatus(
    id: string,
    esperado: StatusLote,
    novo: StatusLote,
    tx: PrismaTransaction,
  ): Promise<void>;
  findById(id: string, tx?: PrismaTransaction): Promise<Lote | null>;
  /** Compara o número dentro da quadra sem diferenciar maiúsculas. */
  existsByNumero(
    quadraId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<boolean>;
  findByQuadraIds(quadraIds: string[], tx?: PrismaTransaction): Promise<Lote[]>;
  list(filtros: LoteFiltros, pagination: Pagination): Promise<Page<Lote>>;
  create(lote: Lote, tx?: PrismaTransaction): Promise<void>;
  createMany(lotes: Lote[], tx?: PrismaTransaction): Promise<void>;
  update(lote: Lote, tx?: PrismaTransaction): Promise<void>;
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
