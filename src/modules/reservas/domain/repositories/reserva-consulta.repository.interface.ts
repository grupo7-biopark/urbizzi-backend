import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { StatusReserva } from '../models/reserva.entity.js';
export interface FiltrosReservas extends Pagination {
  status?: StatusReserva[];
  vendedorId?: string;
  loteamentoId?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
}
export interface ReservaResumo {
  id: string;
  vendedorId: string;
  status: StatusReserva;
  dataInicio: string;
  dataVencimento: string;
  lote: {
    id: string;
    numero: string;
    quadra: string;
    loteamentoId: string;
    loteamento: string;
  };
  cliente: { id: string; nome: string | null };
  propostaAtual: {
    id: string;
    status: 'EM_ANALISE' | 'APROVADA' | 'REJEITADA';
    valor: string;
  } | null;
}
export const RESERVA_CONSULTA_REPOSITORY = Symbol(
  'RESERVA_CONSULTA_REPOSITORY',
);
export interface ReservaConsultaRepository {
  list(filtros: FiltrosReservas): Promise<Page<ReservaResumo>>;
}
