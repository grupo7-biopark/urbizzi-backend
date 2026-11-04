import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { Marcador } from '../models/marcador.entity.js';
export const MARCADOR_REPOSITORY = Symbol('MARCADOR_REPOSITORY');
export interface MarcadorRepository {
  list(plantaId: string, pagination: Pagination): Promise<Page<Marcador>>;
  loteIds(plantaId: string): Promise<string[]>;
  find(
    plantaId: string,
    id: string,
    tx: PrismaTransaction,
  ): Promise<Marcador | null>;
  createMany(marcadores: Marcador[], tx: PrismaTransaction): Promise<void>;
  update(marcador: Marcador, tx: PrismaTransaction): Promise<void>;
  delete(id: string, tx: PrismaTransaction): Promise<void>;
}
