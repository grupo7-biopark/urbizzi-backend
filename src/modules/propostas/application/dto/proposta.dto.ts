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
  @ApiProperty({ enum: ['EM_ANALISE', 'APROVADA', 'REJEITADA'] })
  status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  dataEnvio: Date;
  prazoLimite: Date;
  decididoPorId: string | null;
  dataDecisao: Date | null;
  motivoDecisao: string | null;
  /** Indica se a proposta em análise ultrapassou o prazo limite (RN09) */
  atrasada: boolean;

  static from(proposta: Proposta, agora = new Date()): PropostaDto {
    const dados = proposta.dados;
    return {
      id: dados.id,
      reservaId: dados.reservaId,
      vendedorId: dados.vendedorId,
      valor: dados.valor,
      condicoes: dados.condicoes,
      observacoes: dados.observacoes,
      status: dados.status,
      dataEnvio: dados.dataEnvio,
      prazoLimite: dados.prazoLimite,
      decididoPorId: dados.decididoPorId ?? null,
      dataDecisao: dados.dataDecisao ?? null,
      motivoDecisao: dados.motivoDecisao ?? null,
      atrasada: proposta.isAtrasada(agora),
    };
  }
}
