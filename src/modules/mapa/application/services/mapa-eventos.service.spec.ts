import { Subject } from 'rxjs';
import { MapaEventosService } from './mapa-eventos.service.js';
import type { EventoFonteMapa } from '../../domain/repositories/mapa-eventos-fonte.interface.js';
import type { UsuarioService } from '../../../usuarios/application/services/usuario.service.js';

function setup() {
  vi.useFakeTimers();
  const fonte = new Subject<EventoFonteMapa>();
  const findAtivoById = vi.fn().mockResolvedValue({ id: 'u' });
  const usuarios = { findAtivoById } as unknown as UsuarioService;
  const service = new MapaEventosService({ eventos$: fonte }, usuarios);
  return { fonte, service, findAtivoById };
}

describe('MapaEventosService', () => {
  afterEach(() => vi.useRealTimers());
  it('filtra escopo, minimiza payload, sinaliza sincronizacao e libera timers', async () => {
    const { fonte, service } = setup();
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
  it('revalida usuário ativo, mantém o fluxo e libera os timers no shutdown', async () => {
    const { fonte, service, findAtivoById } = setup();
    const next = vi.fn(),
      complete = vi.fn();
    service
      .observarInterno('u', Date.now() + 60_000)
      .subscribe({ next, complete });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(findAtivoById).toHaveBeenCalledTimes(2);
    expect(findAtivoById).toHaveBeenCalledWith('u');
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

  it('encerra exatamente na expiração, mesmo sem eventos ou revalidação', async () => {
    const { fonte, service, findAtivoById } = setup();
    const next = vi.fn();
    const complete = vi.fn();
    service
      .observarInterno('u', Date.now() + 1234)
      .subscribe({ next, complete });
    await vi.advanceTimersByTimeAsync(1233);
    expect(complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(complete).toHaveBeenCalledOnce();
    fonte.next({ tipo: 'ressincronizar' });
    expect(next).toHaveBeenCalledOnce();
    expect(findAtivoById).not.toHaveBeenCalled();
    expect(fonte.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fecha credencial vencida antes de assinar a fonte', () => {
    const { fonte, service } = setup();
    const next = vi.fn();
    const sub = service.observarInterno('u', Date.now()).subscribe(next);
    expect(sub.closed).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(fonte.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bloqueia mensagem quando o relógio avança antes do callback de expiração', () => {
    const { fonte, service } = setup();
    const expiraEmMs = Date.now() + 1000;
    const next = vi.fn();
    const sub = service.observarInterno('u', expiraEmMs).subscribe(next);
    vi.setSystemTime(expiraEmMs);
    fonte.next({ tipo: 'ressincronizar' });
    expect(next).toHaveBeenCalledOnce();
    expect(sub.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['inativo', 'erro', 'timeout'] as const)(
    'encerra silenciosamente a revalidação com resultado %s',
    async (caso) => {
      const { fonte, service, findAtivoById } = setup();
      if (caso === 'inativo') findAtivoById.mockResolvedValue(null);
      if (caso === 'erro') findAtivoById.mockRejectedValue(new Error('Banco'));
      if (caso === 'timeout')
        findAtivoById.mockImplementation(() => new Promise(() => {}));
      const next = vi.fn();
      const error = vi.fn();
      const complete = vi.fn();
      service
        .observarInterno('u', Date.now() + 60_000)
        .subscribe({ next, error, complete });
      await vi.advanceTimersByTimeAsync(4999);
      expect(complete).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      if (caso === 'timeout') {
        expect(complete).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2000);
      }
      expect(findAtivoById).toHaveBeenCalledOnce();
      expect(complete).toHaveBeenCalledOnce();
      expect(error).not.toHaveBeenCalled();
      fonte.next({ tipo: 'ressincronizar' });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(next).toHaveBeenCalledOnce();
      expect(fonte.observed).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('libera timers e assinatura ao desconectar durante uma consulta', async () => {
    const { fonte, service, findAtivoById } = setup();
    findAtivoById.mockImplementation(() => new Promise(() => {}));
    const sub = service.observarInterno('u', Date.now() + 60_000).subscribe();
    await vi.advanceTimersByTimeAsync(5000);
    expect(findAtivoById).toHaveBeenCalledOnce();
    sub.unsubscribe();
    expect(fonte.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
