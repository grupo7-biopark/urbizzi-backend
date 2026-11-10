import { Subject } from 'rxjs';
import { MapaEventosService } from './mapa-eventos.service.js';
import type { EventoFonteMapa } from '../../domain/repositories/mapa-eventos-fonte.interface.js';
describe('MapaEventosService', () => {
  afterEach(() => vi.useRealTimers());
  it('filtra escopo, minimiza payload, sinaliza sincronizacao e libera timers', async () => {
    vi.useFakeTimers();
    const fonte = new Subject<EventoFonteMapa>();
    const service = new MapaEventosService({ eventos$: fonte });
    const receber = vi.fn();
    const sub = service.observar('norte').subscribe(receber);
    expect(receber).toHaveBeenCalledWith({ type: 'ressincronizar', data: {} });
    receber.mockClear();
    fonte.next({
      tipo: 'status',
      loteId: 'l',
      loteamentoId: 'sul',
      status: 'RESERVADO',
    });
    expect(receber).not.toHaveBeenCalled();
    fonte.next({
      tipo: 'status',
      loteId: 'l',
      loteamentoId: 'norte',
      status: 'RESERVADO',
    });
    expect(receber).toHaveBeenCalledWith({
      type: 'status-lote',
      data: { loteId: 'l', status: 'RESERVADO' },
    });
    fonte.next({ tipo: 'ressincronizar' });
    expect(receber).toHaveBeenLastCalledWith({
      type: 'ressincronizar',
      data: {},
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(receber).toHaveBeenLastCalledWith({ type: 'heartbeat', data: {} });
    sub.unsubscribe();
    expect(fonte.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    service.onModuleDestroy();
  });
  it('permite todos os loteamentos internamente e encerra streams no shutdown', () => {
    vi.useFakeTimers();
    const fonte = new Subject<EventoFonteMapa>();
    const service = new MapaEventosService({ eventos$: fonte });
    const next = vi.fn(),
      complete = vi.fn();
    service.observar().subscribe({ next, complete });
    fonte.next({
      tipo: 'status',
      loteId: 'l',
      loteamentoId: 'sul',
      status: 'VENDIDO',
    });
    expect(next).toHaveBeenLastCalledWith({
      type: 'status-lote',
      data: { loteId: 'l', status: 'VENDIDO' },
    });
    service.onModuleDestroy();
    expect(complete).toHaveBeenCalledOnce();
    expect(fonte.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
