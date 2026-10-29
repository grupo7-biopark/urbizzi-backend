import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
export interface UsuarioProps extends UsuarioAutenticado {
  senhaHash: string;
  ativo: boolean;
}
export class Usuario {
  private constructor(private readonly props: UsuarioProps) {}
  static restore(props: UsuarioProps): Usuario {
    return new Usuario({ ...props });
  }
  get senhaHash() {
    return this.props.senhaHash;
  }
  get ativo() {
    return this.props.ativo;
  }
  get dados(): UsuarioAutenticado {
    const { id, nome, email, perfil } = this.props;
    return { id, nome, email, perfil };
  }
}
