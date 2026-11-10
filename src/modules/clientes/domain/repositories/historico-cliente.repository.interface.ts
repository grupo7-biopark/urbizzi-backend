import type { Pagination, Page } from '../../../../shared/domain/pagination.js';
export interface HistoricoClienteItem {
  tipo: 'RESERVA' | 'PROPOSTA';
  id: string;
  data: string;
  reserva: {
    id: string;
    status: 'ATIVA' | 'CANCELADA' | 'EXPIRADA' | 'CONVERTIDA';
    dataInicio: string;
    dataVencimento: string;
    lote: {
      id: string;
      numero: string;
      quadra: string;
      loteamentoId: string;
      loteamento: string;
    };
  };
  proposta: {
    id: string;
    valor: string;
    status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
    dataEnvio: string;
    prazoLimite: string;
    decisao: { decididoPorId: string; data: string; motivo: string } | null;
  } | null;
}
export const HISTORICO_CLIENTE_REPOSITORY = Symbol(
  'HISTORICO_CLIENTE_REPOSITORY',
);
export interface HistoricoClienteRepository {
  list(
    clienteId: string,
    pagination: Pagination,
    vendedorId?: string,
  ): Promise<Page<HistoricoClienteItem> | null>;
}
