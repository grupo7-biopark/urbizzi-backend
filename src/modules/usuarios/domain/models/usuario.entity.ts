import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
export interface UsuarioProps extends UsuarioAutenticado {
  senhaHash: string;
  ativo: boolean;
}
export class Usuario {
  private constructor(private props: UsuarioProps) {}
  static create(input: Omit<UsuarioProps, 'id' | 'ativo'>): Usuario {
    return new Usuario({ ...input, id: randomUUID(), ativo: true });
  }
  atualizar(
    input: Partial<Pick<UsuarioProps, 'nome' | 'email' | 'perfil'>>,
  ): void {
    this.props = { ...this.props, ...input };
  }
  definirAtivo(ativo: boolean): void {
    this.props = { ...this.props, ativo };
  }
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
