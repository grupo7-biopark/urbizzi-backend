import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Pagination, Page } from '../../../../shared/domain/pagination.js';
import type { Vertices } from '../models/area-geografica.js';
export interface AreaGeografica {
  id: string;
  tipo: 'LOTEAMENTO' | 'QUADRA' | 'LOTE';
  quadraId: string | null;
  loteamentoId: string;
  nome: string;
  status: string | null;
  vertices: Vertices;
}
export const AREA_GEOGRAFICA_REPOSITORY = Symbol('AREA_GEOGRAFICA_REPOSITORY');
export interface AreaGeograficaRepository {
  lock(loteamentoId: string, tx: PrismaTransaction): Promise<void>;
  list(
    loteamentoId: string | undefined,
    pagination: Pagination,
  ): Promise<Page<AreaGeografica>>;
  findById(id: string, tx?: PrismaTransaction): Promise<AreaGeografica | null>;
  children(
    loteamentoId: string,
    tx: PrismaTransaction,
  ): Promise<AreaGeografica[]>;
  scope(
    tipo: 'LOTEAMENTO' | 'LOTE' | 'QUADRA',
    id: string,
    tx: PrismaTransaction,
  ): Promise<string | null>;
  save(
    area: Pick<AreaGeografica, 'id' | 'tipo' | 'loteamentoId' | 'vertices'>,
    tx: PrismaTransaction,
  ): Promise<void>;
  remove(id: string, tx: PrismaTransaction): Promise<void>;
  quadraDoLote(id: string, tx: PrismaTransaction): Promise<string | null>;
}
