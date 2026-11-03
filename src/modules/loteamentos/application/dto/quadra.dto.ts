import type { Quadra } from '../../domain/models/quadra.entity.js';

export class QuadraDto {
  /** @example '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10' */
  id: string;
  /** @example '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  loteamentoId: string;
  /** @example 'A' */
  numero: string;
  createdAt: Date;
  updatedAt: Date;

  static from(quadra: Quadra): QuadraDto {
    const dto = new QuadraDto();
    dto.id = quadra.id;
    dto.loteamentoId = quadra.loteamentoId;
    dto.numero = quadra.numero;
    dto.createdAt = quadra.createdAt;
    dto.updatedAt = quadra.updatedAt;
    return dto;
  }
}
