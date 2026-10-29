import { createHash, randomBytes, randomUUID } from 'node:crypto';
export interface SessaoProps {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
}
export class Sessao {
  private constructor(private readonly props: SessaoProps) {}
  static create(
    usuarioId: string,
    validadeSegundos: number,
  ): { sessao: Sessao; token: string } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      sessao: new Sessao({
        id: randomUUID(),
        usuarioId,
        tokenHash: Sessao.hashToken(token),
        expiraEm: new Date(Date.now() + validadeSegundos * 1000),
      }),
    };
  }
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  static restore(props: SessaoProps): Sessao {
    return new Sessao({ ...props });
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
