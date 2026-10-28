import type { Usuario } from '../models/usuario.entity.js';
export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
export interface UsuarioRepository {
  findById(id: string): Promise<Usuario | null>;
  findByEmail(email: string): Promise<Usuario | null>;
}
