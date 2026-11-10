import {
  Inject,
  Injectable,
  type MessageEvent,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  EMPTY,
  Subject,
  catchError,
  concat,
  defer,
  exhaustMap,
  of,
  merge,
  filter,
  map,
  interval,
  takeUntil,
  takeWhile,
  timeout,
  timer,
  type Observable,
} from 'rxjs';
import { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';
import {
  MAPA_EVENTOS_FONTE,
  type MapaEventosFonte,
} from '../../domain/repositories/mapa-eventos-fonte.interface.js';

const REVALIDACAO_MS = 5000;
const LIMITE_CONSULTA_MS = 2000;

@Injectable()
export class MapaEventosService implements OnModuleDestroy {
  private readonly fim = new Subject<void>();
  constructor(
    @Inject(MAPA_EVENTOS_FONTE) private readonly fonte: MapaEventosFonte,
    private readonly usuarios: UsuarioService,
  ) {}
  onModuleDestroy() {
    this.fim.next();
    this.fim.complete();
  }

  observarInterno(
    usuarioId: string,
    expiraEmMs: number,
  ): Observable<MessageEvent> {
    return defer(() => {
      const restante = expiraEmMs - Date.now();
      if (!Number.isFinite(restante) || restante <= 0) return EMPTY;

      const acessoInvalido = timer(REVALIDACAO_MS, REVALIDACAO_MS).pipe(
        exhaustMap(() =>
          defer(() => this.usuarios.findAtivoById(usuarioId)).pipe(
            timeout({ first: LIMITE_CONSULTA_MS }),
            catchError(() => of(null)),
          ),
        ),
        filter((usuario) => usuario === null),
      );
      return this.observar().pipe(
        takeUntil(merge(timer(restante), acessoInvalido)),
        takeWhile(() => Date.now() < expiraEmMs),
      );
    });
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
