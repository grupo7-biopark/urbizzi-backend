import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import { ProcessamentoPlantaService } from '../../application/services/processamento-planta.service.js';

/**
 * Worker da fila de plantas, no próprio processo da API. Consulta a fila a
 * cada `PLANTAS_FILA_INTERVALO_MS` e processa uma planta por vez; o trabalho
 * pesado roda nas threads do libvips, então a API continua respondendo.
 */
@Injectable()
export class PlantasWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PlantasWorker.name);
  private timer?: NodeJS.Timeout;
  private execucao?: Promise<void>;
  private parado = true;

  constructor(
    private readonly processamento: ProcessamentoPlantaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('PLANTAS_PROCESSAMENTO_ATIVO', { infer: true })) {
      this.iniciar();
    }
  }

  /** Começa a consumir a fila (chamado no bootstrap quando ativo). */
  iniciar(): void {
    if (!this.parado) return;
    this.parado = false;
    this.agendar(0);
  }

  /** Para de consultar a fila e espera a planta em andamento terminar. */
  async parar(): Promise<void> {
    this.parado = true;
    clearTimeout(this.timer);
    await this.execucao;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.parar();
  }

  private agendar(atraso: number): void {
    this.timer = setTimeout(() => {
      this.execucao = this.esvaziarFila().finally(() => {
        this.execucao = undefined;
        if (!this.parado) {
          this.agendar(
            this.config.get('PLANTAS_FILA_INTERVALO_MS', { infer: true }),
          );
        }
      });
    }, atraso);
  }

  private async esvaziarFila(): Promise<void> {
    try {
      while (!this.parado) {
        const resultado = await this.processamento.processarProxima();
        if (!resultado) return;
        if (resultado.status === 'PRONTA') {
          this.logger.log(`Planta ${resultado.plantaId} processada`);
        } else {
          this.logger.error(
            `Falha ao processar a planta ${resultado.plantaId}`,
            resultado.erro instanceof Error
              ? resultado.erro.stack
              : String(resultado.erro),
          );
        }
      }
    } catch (erro) {
      // Falha ao acessar a fila (ex.: banco fora); tenta de novo no próximo ciclo.
      this.logger.error(
        'Falha ao consultar a fila de plantas',
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }
}
