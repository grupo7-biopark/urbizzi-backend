import { ApiProperty } from '@nestjs/swagger';
import type { Proposta } from '../../domain/models/proposta.entity.js';
export class PropostaDto {
  id: string;
  reservaId: string;
  vendedorId: string;
  /** Valor monetário como texto decimal. @example '250000.00' */
  valor: string;
  condicoes: string;
  observacoes: string | null;
  @ApiProperty({ enum: ['EM_ANALISE', 'APROVADA', 'REJEITADA'] }) status:
    'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  dataEnvio: Date;
  prazoLimite: Date;
  static from(proposta: Proposta): PropostaDto {
    return proposta.dados;
  }
}
