import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import { PgMapaEventosFonte } from './pg-mapa-eventos-fonte.js';
const pg = vi.hoisted(() => ({
  on: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}));
vi.mock('pg', () => ({
  Client: class {
    on = pg.on;
    connect = pg.connect;
    query = pg.query;
    end = pg.end;
  },
}));
describe('PgMapaEventosFonte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    pg.connect.mockResolvedValue(undefined);
    pg.query.mockResolvedValue(undefined);
    pg.end.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());
  const criar = () =>
    new PgMapaEventosFonte({
      get: () => 'postgres://teste',
    } as unknown as ConfigService<Env, true>);
  it('emite ressincronização a cada LISTEN, inclusive depois de falha e reconexão', async () => {
    const fonte = criar(),
      next = vi.fn();
    fonte.eventos$.subscribe(next);
    await fonte.onModuleInit();
    expect(next).toHaveBeenLastCalledWith({ tipo: 'ressincronizar' });
    const erro = pg.on.mock.calls.find(
      ([e]) => e === 'error',
    )![1] as () => void;
    const fim = pg.on.mock.calls.find(([e]) => e === 'end')![1] as () => void;
    erro();
    fim();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(pg.query).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(2);
    await fonte.onModuleDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('valida notificações e remove campos que não pertencem ao contrato', async () => {
    const fonte = criar(),
      next = vi.fn();
    fonte.eventos$.subscribe(next);
    await fonte.onModuleInit();
    next.mockClear();
    const notificar = pg.on.mock.calls.find(
      ([e]) => e === 'notification',
    )![1] as (m: { channel: string; payload?: string }) => void;
    notificar({ channel: 'outro', payload: '{}' });
    notificar({ channel: 'status_lote' });
    notificar({ channel: 'status_lote', payload: 'inválido' });
    notificar({ channel: 'status_lote', payload: '{}' });
    expect(next).not.toHaveBeenCalled();
    const evento = {
      loteId: 'a51bc285-714e-4930-9c58-b379b397b133',
      loteamentoId: '067e3d77-f5a9-489c-b97b-b56a8f8daf87',
      status: 'RESERVADO',
    };
    notificar({
      channel: 'status_lote',
      payload: JSON.stringify({ ...evento, cliente: 'não deve sair' }),
    });
    expect(next).toHaveBeenCalledWith({ tipo: 'status', ...evento });
    await fonte.onModuleDestroy();
  });
  it('reagenda falha inicial e cancela a reconexão ao encerrar', async () => {
    pg.connect.mockRejectedValueOnce(new Error('Falha simulada'));
    const fonte = criar();
    await fonte.onModuleInit();
    expect(vi.getTimerCount()).toBe(1);
    await fonte.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(10000);
    expect(pg.connect).toHaveBeenCalledOnce();
  });
});
