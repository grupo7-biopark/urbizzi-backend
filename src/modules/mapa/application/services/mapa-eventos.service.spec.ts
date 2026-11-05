import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import { MapaEventosService } from './mapa-eventos.service.js';

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

describe('MapaEventosService', () => {
  it('filtra o loteamento e envia só loteId e status, com heartbeat', async () => {
    vi.useFakeTimers();
    const service = new MapaEventosService({
      get: () => 'postgres://test',
    } as unknown as ConfigService<Env, true>);
    try {
      service.onModuleInit();
      const notificar = pg.on.mock.calls.find(
        ([evento]) => evento === 'notification',
      )?.[1] as (msg: { channel: string; payload: string }) => void;
      const loteId = 'a51bc285-714e-4930-9c58-b379b397b133';
      const loteamentoId = '067e3d77-f5a9-489c-b97b-b56a8f8daf87';
      const receber = vi.fn();
      service.observar(loteamentoId).subscribe(receber);
      notificar({
        channel: 'status_lote',
        payload: JSON.stringify({
          loteId,
          status: 'RESERVADO',
          loteamentoId: loteId,
        }),
      });
      expect(receber).not.toHaveBeenCalled();
      notificar({
        channel: 'status_lote',
        payload: JSON.stringify({ loteId, status: 'RESERVADO', loteamentoId }),
      });
      expect(receber).toHaveBeenCalledWith({
        type: 'status-lote',
        data: { loteId, status: 'RESERVADO' },
      });
      await vi.advanceTimersByTimeAsync(15000);
      expect(receber).toHaveBeenLastCalledWith({ type: 'heartbeat', data: {} });
    } finally {
      await service.onModuleDestroy();
      vi.useRealTimers();
    }
  });
});
