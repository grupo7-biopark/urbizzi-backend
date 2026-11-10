export type StatusLotePainel =
  'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO';

export interface FiltrosResumoPainel {
  loteamentoId?: string;
  dataDe?: Date;
  dataAte?: Date;
}

export interface PainelResumoLoteamento {
  id: string;
  loteamentoId: string;
  nome: string;
  total: number;
  disponivel: number;
  reservado: number;
  vendido: number;
  bloqueado: number;
  porStatus: Record<StatusLotePainel, number>;
}

export interface PainelResumo {
  geral: {
    total: number;
    disponivel: number;
    reservado: number;
    vendido: number;
    bloqueado: number;
    porStatus: Record<StatusLotePainel, number>;
  };
  porLoteamento: PainelResumoLoteamento[];
  total: number;
  disponivel: number;
  reservado: number;
  vendido: number;
  bloqueado: number;
  porStatus: Record<StatusLotePainel, number>;
}

export type AgrupamentoPeriodo = 'dia' | 'semana' | 'mes';

export interface FiltrosVendasPainel {
  loteamentoId?: string;
  vendedorId?: string;
  dataDe?: Date;
  dataAte?: Date;
  agrupamento?: AgrupamentoPeriodo;
}

export interface PainelVendaPeriodoItem {
  periodo: string;
  quantidade: number;
  valorTotal: string;
}

export interface PainelVendaDiaItem {
  data: string;
  quantidade: number;
  valorTotal: string;
}

export interface PainelVendaSemanaItem {
  semana: string;
  quantidade: number;
  valorTotal: string;
}

export interface PainelVendaMesItem {
  mes: string;
  quantidade: number;
  valorTotal: string;
}

export interface PainelVendaVendedorItem {
  vendedorId: string;
  nome: string;
  quantidade: number;
  valorTotal: string;
}

export interface PainelVendas {
  total: number;
  valorTotal: string;
  periodo: {
    dia: number;
    semana: number;
    mes: number;
  };
  resumo: {
    dia: number;
    semana: number;
    mes: number;
  };
  porPeriodo: PainelVendaPeriodoItem[];
  porDia: PainelVendaDiaItem[];
  porSemana: PainelVendaSemanaItem[];
  porMes: PainelVendaMesItem[];
  porVendedor: PainelVendaVendedorItem[];
}

export interface FiltrosPendenciasPainel {
  loteamentoId?: string;
  vendedorId?: string;
  dataDe?: Date;
  dataAte?: Date;
  limiteBreve: Date;
}

export interface PainelPendencias {
  reservasAtivas: number;
  reservasVencendoEmBreve: number;
  propostasPendentes: number;
  propostasAtrasadas: number;
  total: number;
  reservas: {
    ativas: number;
    vencendoEmBreve: number;
  };
  propostas: {
    pendentes: number;
    atrasadas: number;
    emDia: number;
  };
}

export const PAINEL_CONSULTA_REPOSITORY = Symbol('PAINEL_CONSULTA_REPOSITORY');

export interface PainelConsultaRepository {
  obterResumo(filtros: FiltrosResumoPainel): Promise<PainelResumo>;
  obterVendas(filtros: FiltrosVendasPainel): Promise<PainelVendas>;
  obterPendencias(filtros: FiltrosPendenciasPainel): Promise<PainelPendencias>;
}
