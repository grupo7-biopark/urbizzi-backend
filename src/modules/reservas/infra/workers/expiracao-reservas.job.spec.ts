import { Logger } from '@nestjs/common';
import { ExpiracaoReservasJob } from './expiracao-reservas.job.js';
import type { ExpiracaoReservaService } from '../../application/services/expiracao-reserva.service.js';
describe('Agendamento de expiração', () => {
  afterEach(() => vi.restoreAllMocks());
  it('não sobrepõe ciclos e aguarda conclusão ao encerrar', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    let liberar!: (value: { expiradas: number; falhas: number }) => void;
    const service = {
      executar: vi.fn(
        () =>
          new Promise<{ expiradas: number; falhas: number }>((resolve) => {
            liberar = resolve;
          }),
      ),
    };
    const job = new ExpiracaoReservasJob(
      service as unknown as ExpiracaoReservaService,
    );
    const a = job.executar();
    const b = job.executar();
    const encerramento = job.onModuleDestroy();
    expect(service.executar).toHaveBeenCalledOnce();
    liberar({ expiradas: 1, falhas: 0 });
    await Promise.all([a, b, encerramento]);
    await job.executar();
    expect(service.executar).toHaveBeenCalledOnce();
  });
  it('registra falha genérica e permite o próximo ciclo', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const service = {
      executar: vi
        .fn()
        .mockRejectedValueOnce(new Error('segredo'))
        .mockResolvedValue({ expiradas: 0, falhas: 0 }),
    };
    const job = new ExpiracaoReservasJob(
      service as unknown as ExpiracaoReservaService,
    );
    await job.executar();
    expect(log).toHaveBeenCalledWith('Falha ao consultar reservas vencidas');
    await job.executar();
    expect(service.executar).toHaveBeenCalledTimes(2);
  });
});
