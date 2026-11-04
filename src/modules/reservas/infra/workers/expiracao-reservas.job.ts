import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ExpiracaoReservaService } from '../../application/services/expiracao-reserva.service.js';
@Injectable()
export class ExpiracaoReservasJob implements OnModuleDestroy {
  private readonly logger = new Logger(ExpiracaoReservasJob.name);
  private pendente: Promise<void> | null = null;
  private encerrando = false;
  constructor(private readonly service: ExpiracaoReservaService) {}
  @Interval('expirar-reservas', 300000)
  async executar(): Promise<void> {
    if (this.encerrando) return;
    if (this.pendente) return this.pendente;
    this.pendente = this.service
      .executar()
      .then(({ expiradas, falhas }) => {
        this.logger.log(`${expiradas} reservas expiradas; ${falhas} falhas`);
      })
      .catch(() => {
        this.logger.error('Falha ao consultar reservas vencidas');
      });
    try {
      await this.pendente;
    } finally {
      this.pendente = null;
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    await this.pendente;
  }
}
