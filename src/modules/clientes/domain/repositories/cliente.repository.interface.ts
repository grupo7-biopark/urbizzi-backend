import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Cliente } from '../models/cliente.entity.js';
export const CLIENTE_REPOSITORY = Symbol('CLIENTE_REPOSITORY');
export interface ClienteRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Cliente | null>;
  existsByDocumento(documento: string, ignoreId?: string): Promise<boolean>;
  list(q: string | undefined, pagination: Pagination): Promise<Page<Cliente>>;
  save(cliente: Cliente, tx: PrismaTransaction): Promise<void>;
}
