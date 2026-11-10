import {
  Inject,
  Injectable,
  type MessageEvent,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  Subject,
  concat,
  of,
  merge,
  filter,
  map,
  interval,
  takeUntil,
  type Observable,
} from 'rxjs';
import {
  MAPA_EVENTOS_FONTE,
  type MapaEventosFonte,
} from '../../domain/repositories/mapa-eventos-fonte.interface.js';
@Injectable()
export class MapaEventosService implements OnModuleDestroy {
  private readonly fim = new Subject<void>();
  constructor(
    @Inject(MAPA_EVENTOS_FONTE) private readonly fonte: MapaEventosFonte,
  ) {}
  onModuleDestroy() {
    this.fim.next();
    this.fim.complete();
  }
  observar(loteamentoId?: string): Observable<MessageEvent> {
    return concat(
      of({ type: 'ressincronizar', data: {} }),
      merge(
        this.fonte.eventos$.pipe(
          filter(
            (e) =>
              e.tipo === 'ressincronizar' ||
              !loteamentoId ||
              e.loteamentoId === loteamentoId,
          ),
          map((e) =>
            e.tipo === 'ressincronizar'
              ? { type: 'ressincronizar', data: {} }
              : {
                  type: 'status-lote',
                  data: { loteId: e.loteId, status: e.status },
                },
          ),
        ),
        interval(15000).pipe(map(() => ({ type: 'heartbeat', data: {} }))),
      ),
    ).pipe(takeUntil(this.fim));
  }
}
