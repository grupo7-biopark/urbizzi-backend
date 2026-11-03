import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Planta, StatusPlanta } from '../models/planta.entity.js';

export const PLANTA_REPOSITORY = Symbol('PLANTA_REPOSITORY');

export interface PlantaFiltros {
  status?: StatusPlanta[];
}

export interface PlantaRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Planta | null>;
  list(filtros: PlantaFiltros, pagination: Pagination): Promise<Page<Planta>>;
  /**
   * Próximo número de versão. Bloqueia a numeração até o fim da transação,
   * para dois envios simultâneos não pegarem a mesma versão.
   */
  proximaVersao(tx: PrismaTransaction): Promise<number>;
  create(planta: Planta, tx?: PrismaTransaction): Promise<void>;
}
