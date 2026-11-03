import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { ValorAuditoria } from '../models/historico-auditoria.entity.js';
export const HISTORICO_CONSULTA_REPOSITORY = Symbol(
  'HISTORICO_CONSULTA_REPOSITORY',
);
export interface HistoricoFiltros {
  entidadeTipo?: string;
  entidadeId?: string;
  usuarioId?: string;
  dataDe?: Date;
  dataAte?: Date;
  vendedorId?: string;
}
export interface HistoricoConsulta {
  id: string;
  usuario: { id: string; nome: string } | null;
  entidadeTipo: string;
  entidadeId: string;
  acao: string;
  valorAnterior: ValorAuditoria;
  valorNovo: ValorAuditoria;
  motivo: string | null;
  createdAt: Date;
}
export interface HistoricoConsultaRepository {
  list(
    filtros: HistoricoFiltros,
    pagination: Pagination,
  ): Promise<Page<HistoricoConsulta>>;
}
