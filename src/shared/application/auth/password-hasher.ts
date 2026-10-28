export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(senha: string): Promise<string>;
  verify(hash: string, senha: string): Promise<boolean>;
}
