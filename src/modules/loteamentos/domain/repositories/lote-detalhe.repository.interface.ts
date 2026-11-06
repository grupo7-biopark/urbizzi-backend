import type { LoteProps } from '../models/lote.entity.js';

export const LOTE_DETALHE_REPOSITORY = Symbol('LOTE_DETALHE_REPOSITORY');

interface Referencia {
  id: string;
  nome: string;
}

export interface ReservaNoLote {
  id: string;
  status: 'ATIVA' | 'CONVERTIDA';
  dataInicio: string;
  dataVencimento: string;
  cliente: { id: string; nome: string | null };
  vendedor: Referencia;
}

export interface PropostaNoLote {
  id: string;
  status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
  valor: string;
  dataEnvio: string;
  prazoLimite: string;
  dataDecisao: string | null;
}

export interface EventoNoLote {
  id: string;
  entidadeTipo: 'Lote' | 'Reserva' | 'Proposta';
  entidadeId: string;
  acao: string;
  createdAt: string;
}

export interface LoteDetalhe {
  lote: Omit<LoteProps, 'teveReserva'>;
  quadra: { id: string; numero: string };
  loteamento: Referencia;
  reserva: ReservaNoLote | null;
  propostas: PropostaNoLote[];
  historico: EventoNoLote[];
}

export interface EscopoLoteDetalhe {
  podeVerReservas: boolean;
  podeVerAuditoriaDoLote: boolean;
  vendedorId?: string;
}

export interface LoteDetalheRepository {
  find(id: string, escopo: EscopoLoteDetalhe): Promise<LoteDetalhe | null>;
}
