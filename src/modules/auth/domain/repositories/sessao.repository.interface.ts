import type { Sessao } from '../models/sessao.entity.js';
export const SESSAO_REPOSITORY = Symbol('SESSAO_REPOSITORY');
export interface SessaoRepository {
  create(sessao: Sessao): Promise<void>;
  findValida(tokenHash: string): Promise<Sessao | null>;
  rotate(tokenHash: string, nova: Sessao): Promise<boolean>;
  revoke(tokenHash: string): Promise<void>;
}
