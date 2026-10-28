export const ACCESS_TOKEN = Symbol('ACCESS_TOKEN');
export interface AccessToken {
  readonly expiresIn: number;
  readonly refreshExpiresIn: number;
  sign(usuario: { id: string; nome: string; perfil: string }): Promise<string>;
  verify(token: string): Promise<string | null>;
}
