export class LinkPublicoDto {
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  id: string;
  /** Token opaco de 32 bytes; não registrar em logs. @example 'token-base64url' */
  token: string;
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  criadoPorId: string;
  /** @example null */
  loteamentoId: string | null;
  /** @example true */
  ativo: boolean;
  /** @example 0 */
  acessos: number;
  /** @example '2026-11-03T12:00:00Z' */
  createdAt: Date;
  /** @example '2026-11-03T12:00:00Z' */
  updatedAt: Date;
}
