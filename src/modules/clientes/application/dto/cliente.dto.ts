import type { Cliente } from '../../domain/models/cliente.entity.js';
export class ClienteResumoDto {
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  id: string;
  /** @example 'Cliente Teste' */
  nome: string;
  static from(cliente: Cliente): ClienteResumoDto {
    return { id: cliente.id, nome: cliente.dados.nome };
  }
}
export class ClienteDto extends ClienteResumoDto {
  /** @example '52998224725' */
  documento: string;
  /** @example '45999999999' */
  telefone: string | null;
  /** @example 'cliente@exemplo.com' */
  email: string | null;
  /** @example null */
  observacoes: string | null;
  /** @example '2026-11-03T12:00:00Z' */
  createdAt: Date;
  /** @example '2026-11-03T12:00:00Z' */
  updatedAt: Date;
  static from(cliente: Cliente): ClienteDto {
    return cliente.dados;
  }
}
