import { randomBytes, randomUUID } from 'node:crypto';
export interface LinkPublicoProps {
  id: string;
  token: string;
  criadoPorId: string;
  loteamentoId: string | null;
  ativo: boolean;
  acessos: number;
  createdAt: Date;
  updatedAt: Date;
}
export class LinkPublico {
  private constructor(private props: LinkPublicoProps) {}
  static create(
    criadoPorId: string,
    loteamentoId: string | null = null,
  ): LinkPublico {
    const now = new Date();
    return new LinkPublico({
      id: randomUUID(),
      token: randomBytes(32).toString('base64url'),
      criadoPorId,
      loteamentoId,
      ativo: true,
      acessos: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  static restore(props: LinkPublicoProps): LinkPublico {
    return new LinkPublico({ ...props });
  }
  desativar(): void {
    this.props = { ...this.props, ativo: false, updatedAt: new Date() };
  }
  get dados(): LinkPublicoProps {
    return { ...this.props };
  }
}
