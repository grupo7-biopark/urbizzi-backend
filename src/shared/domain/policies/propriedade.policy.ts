import { ForbiddenError } from '../errors/domain.error.js';
import type { UsuarioAutenticado } from '../usuario-autenticado.js';
/** Base para ações de Admin/Gestor ou Comercial responsável pelo recurso. */
export class PropriedadePolicy {
  static assertPodeAlterar(
    usuario: Pick<UsuarioAutenticado, 'id' | 'perfil'>,
    responsavelId: string,
  ): void {
    if (usuario.perfil === 'ADMINISTRADOR' || usuario.perfil === 'GESTOR')
      return;
    if (usuario.perfil === 'COMERCIAL' && usuario.id === responsavelId) return;
    throw new ForbiddenError(
      'ACESSO_NEGADO',
      'Você não tem permissão para executar esta ação',
    );
  }
}
