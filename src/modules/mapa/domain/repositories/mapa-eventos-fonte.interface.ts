import type { Observable } from 'rxjs';
export const MAPA_EVENTOS_FONTE = Symbol('MAPA_EVENTOS_FONTE');
export type EventoFonteMapa =
  | { tipo: 'ressincronizar' }
  | {
      tipo: 'status';
      loteId: string;
      loteamentoId: string;
      status: 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO';
    };
export interface MapaEventosFonte {
  readonly eventos$: Observable<EventoFonteMapa>;
}
