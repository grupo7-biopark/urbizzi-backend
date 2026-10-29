export class TokensDto {
  /** Token de acesso JWT. @example 'eyJ...' */
  accessToken: string;
  /** Token opaco de renovação; substitua-o após cada refresh. @example 'token-aleatorio' */
  refreshToken: string;
  /** Esquema de autenticação. @example 'Bearer' */
  tokenType: string;
  /** Validade do access token em segundos. @example 900 */
  expiresIn: number;
}
