import { ApiProperty } from '@nestjs/swagger';
import type { ValorAuditoria } from '../../domain/models/historico-auditoria.entity.js';
export class HistoricoDto {
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  id: string;
  /** Autor ou null para sistema. @example { id: '2872822b-14be-41ea-881f-a8c0c11c1ffd', nome: 'Usuário Teste' } */
  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true })
  usuario: { id: string; nome: string } | null;
  /** @example 'Reserva' */
  entidadeTipo: string;
  /** @example '2872822b-14be-41ea-881f-a8c0c11c1ffd' */
  entidadeId: string;
  /** @example 'CANCELAR' */
  acao: string;
  @ApiProperty({
    nullable: true,
    oneOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
    ],
  })
  valorAnterior: ValorAuditoria;
  @ApiProperty({
    nullable: true,
    oneOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
    ],
  })
  valorNovo: ValorAuditoria;
  /** @example 'Solicitação de cancelamento' */
  motivo: string | null;
  /** @example '2026-11-03T12:00:00Z' */
  createdAt: Date;
}
