import { createHash, randomBytes, randomUUID } from 'node:crypto';
export interface TokenRecuperacaoSenhaProps {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}
export class TokenRecuperacaoSenha {
  private constructor(private readonly props: TokenRecuperacaoSenhaProps) {}
  static create(usuarioId: string): {
    entidade: TokenRecuperacaoSenha;
    token: string;
  } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      entidade: new TokenRecuperacaoSenha({
        id: randomUUID(),
        usuarioId,
        tokenHash: this.hashToken(token),
        expiraEm: new Date(Date.now() + 3600000),
        usadoEm: null,
      }),
    };
  }
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  static restore(props: TokenRecuperacaoSenhaProps): TokenRecuperacaoSenha {
    return new TokenRecuperacaoSenha({ ...props });
  }
  isValido(): boolean {
    return (
      this.props.usadoEm === null && this.props.expiraEm.getTime() > Date.now()
    );
  }
  get id() {
    return this.props.id;
  }
  get usuarioId() {
    return this.props.usuarioId;
  }
  get tokenHash() {
    return this.props.tokenHash;
  }
  get expiraEm() {
    return new Date(this.props.expiraEm);
  }
}
