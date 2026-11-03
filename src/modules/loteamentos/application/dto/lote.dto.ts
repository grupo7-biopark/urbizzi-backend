import { ApiProperty } from '@nestjs/swagger';
import { StatusLote } from '../../../../generated/prisma/client.js';
import type { Lote } from '../../domain/models/lote.entity.js';

export class LoteDto {
  /** @example '5d2f8a1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  id: string;
  /** @example '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  loteamentoId: string;
  /** @example '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10' */
  quadraId: string;
  /** @example '12' */
  numero: string;
  /**
   * Área em m², com 2 casas decimais
   * @example '360.00'
   */
  areaM2: string;
  /**
   * Valor de venda, com 2 casas decimais
   * @example '250000.00'
   */
  valor: string | null;
  /** @example false */
  exibirValorPublico: boolean;
  /** @example 'DISPONIVEL' */
  @ApiProperty({ enum: StatusLote, enumName: 'StatusLote' })
  status: StatusLote;
  /** @example 'Lote de esquina' */
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(lote: Lote): LoteDto {
    const dto = new LoteDto();
    dto.id = lote.id;
    dto.loteamentoId = lote.loteamentoId;
    dto.quadraId = lote.quadraId;
    dto.numero = lote.numero;
    dto.areaM2 = lote.areaM2;
    dto.valor = lote.valor;
    dto.exibirValorPublico = lote.exibirValorPublico;
    dto.status = lote.status;
    dto.observacoes = lote.observacoes;
    dto.createdAt = lote.createdAt;
    dto.updatedAt = lote.updatedAt;
    return dto;
  }
}
