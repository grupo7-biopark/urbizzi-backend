import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
export type StatusLoteMapa =
  'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO';
export interface FiltrosMapa extends Pagination {
  loteamentoId?: string;
  status?: StatusLoteMapa[];
}
/** Projeção de leitura: nenhum dado de cliente ou conteúdo de proposta. */
export interface ItemMapa {
  id: string;
  loteId: string;
  x: number;
  y: number;
  numero: string;
  quadraId: string;
  quadra: string;
  loteamentoId: string;
  loteamento: string;
  areaM2: string;
  valor: string | null;
  status: StatusLoteMapa;
  exibirValorPublico: boolean;
  vendedorId: string | null;
  propostaAprovada: boolean;
}
export const MAPA_CONSULTA_REPOSITORY = Symbol('MAPA_CONSULTA_REPOSITORY');
export interface MapaConsultaRepository {
  list(plantaId: string, filtros: FiltrosMapa): Promise<Page<ItemMapa>>;
}
