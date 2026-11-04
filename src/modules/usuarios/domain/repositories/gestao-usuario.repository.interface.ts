import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { Usuario } from '../models/usuario.entity.js';
export interface FiltrosUsuarios extends Pagination {
  perfil?: UsuarioAutenticado['perfil'];
  ativo?: boolean;
}
export const GESTAO_USUARIO_REPOSITORY = Symbol('GESTAO_USUARIO_REPOSITORY');
export interface GestaoUsuarioRepository {
  list(filtros: FiltrosUsuarios): Promise<Page<Usuario>>;
  bloquearGestao(tx: PrismaTransaction): Promise<void>;
  countAdministradores(tx: PrismaTransaction): Promise<number>;
  save(usuario: Usuario, tx: PrismaTransaction): Promise<void>;
}
