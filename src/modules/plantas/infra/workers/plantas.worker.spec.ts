import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import type {
  ProcessamentoPlantaService,
  ResultadoProcessamento,
} from '../../application/services/processamento-planta.service.js';
import { PlantasWorker } from './plantas.worker.js';

describe('PlantasWorker', () => {
  let processarProxima: ReturnType<typeof vi.fn>;
  let worker: PlantasWorker;

  function criar(ativo: boolean) {
    const valores = {
      PLANTAS_PROCESSAMENTO_ATIVO: ativo,
      PLANTAS_FILA_INTERVALO_MS: 1000,
    };
    const config = {
      get: (chave: keyof typeof valores) => valores[chave],
    } as unknown as ConfigService<Env, true>;
    processarProxima = vi.fn();
    worker = new PlantasWorker(
      { processarProxima } as unknown as ProcessamentoPlantaService,
      config,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await worker.onApplicationShutdown();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('não consulta a fila quando desativado', async () => {
    criar(false);
    worker.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(5000);
    expect(processarProxima).not.toHaveBeenCalled();
  });

  it('esvazia a fila e volta a consultar após o intervalo', async () => {
    criar(true);
    const pronta: ResultadoProcessamento = { plantaId: 'a', status: 'PRONTA' };
    const erro: ResultadoProcessamento = {
      plantaId: 'b',
      status: 'ERRO',
      erro: new Error('falhou'),
    };
    processarProxima
      .mockResolvedValueOnce(pronta)
      .mockResolvedValueOnce(erro)
      .mockResolvedValue(null);

    worker.onApplicationBootstrap();
    worker.iniciar(); // idempotente
    await vi.advanceTimersByTimeAsync(0);

    expect(processarProxima).toHaveBeenCalledTimes(3);
    expect(Logger.prototype.log).toHaveBeenCalledWith('Planta a processada');
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Falha ao processar a planta b',
      expect.stringContaining('falhou'),
    );

    await vi.advanceTimersByTimeAsync(999);
    expect(processarProxima).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(processarProxima).toHaveBeenCalledTimes(4);
  });

  it('registra falha de acesso à fila e tenta de novo', async () => {
    criar(true);
    processarProxima
      .mockRejectedValueOnce('banco fora')
      .mockResolvedValue(null);

    worker.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Falha ao consultar a fila de plantas',
      'banco fora',
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(processarProxima).toHaveBeenCalledTimes(2);
  });

  it('ao parar, espera a planta em andamento e não agenda outra', async () => {
    criar(true);
    let concluir!: (r: ResultadoProcessamento | null) => void;
    processarProxima.mockImplementationOnce(
      () => new Promise((resolve) => (concluir = resolve)),
    );

    worker.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const parada = worker.parar();
    concluir({ plantaId: 'a', status: 'PRONTA' });
    await parada;

    await vi.advanceTimersByTimeAsync(10_000);
    expect(processarProxima).toHaveBeenCalledTimes(1);
  });
});
