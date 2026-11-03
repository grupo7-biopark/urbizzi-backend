import type { Loteamento } from '../../domain/models/loteamento.entity.js';

export class LoteamentoDto {
  /** @example '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  id: string;
  /** @example 'Residencial Bela Vista' */
  nome: string;
  /** @example 'Loteamento residencial com 120 lotes' */
  descricao: string | null;
  /** @example 'Av. Parigot de Souza, Toledo - PR' */
  localizacao: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(loteamento: Loteamento): LoteamentoDto {
    const dto = new LoteamentoDto();
    dto.id = loteamento.id;
    dto.nome = loteamento.nome;
    dto.descricao = loteamento.descricao;
    dto.localizacao = loteamento.localizacao;
    dto.createdAt = loteamento.createdAt;
    dto.updatedAt = loteamento.updatedAt;
    return dto;
  }
}
