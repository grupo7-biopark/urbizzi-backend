import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { LinkPublico } from '../models/link-publico.entity.js';
export const LINK_PUBLICO_REPOSITORY = Symbol('LINK_PUBLICO_REPOSITORY');
export interface LinkPublicoRepository {
  create(link: LinkPublico, tx: PrismaTransaction): Promise<void>;
  findById(id: string, tx?: PrismaTransaction): Promise<LinkPublico | null>;
  list(
    criadoPorId: string | undefined,
    pagination: Pagination,
  ): Promise<Page<LinkPublico>>;
  desativar(id: string, tx: PrismaTransaction): Promise<boolean>;
  registrarAcesso(token: string): Promise<LinkPublico | null>;
}
