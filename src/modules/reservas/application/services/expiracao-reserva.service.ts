import { Inject, Injectable } from '@nestjs/common';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { LoteService } from '../../../loteamentos/application/services/lote.service.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  EXPIRACAO_RESERVA_REPOSITORY,
  type ExpiracaoReservaRepository,
} from '../../domain/repositories/expiracao-reserva.repository.interface.js';
@Injectable()
export class ExpiracaoReservaService {
  constructor(
    @Inject(EXPIRACAO_RESERVA_REPOSITORY)
    private readonly repository: ExpiracaoReservaRepository,
    private readonly lotes: LoteService,
    private readonly auditoria: AuditoriaService,
    private readonly transactions: TransactionManager,
  ) {}
  async executar(
    agora = new Date(),
  ): Promise<{ expiradas: number; falhas: number }> {
    let expiradas = 0,
      falhas = 0;
    let aposId: string | undefined;
    while (true) {
      const ids = await this.repository.candidatas(agora, aposId);
      if (!ids.length) break;
      for (const id of ids) {
        try {
          const alterada = await this.transactions.run(async (tx) => {
            const reserva = await this.repository.travarVencida(id, agora, tx);
            if (!reserva) return false;
            reserva.expirar(agora);
            await this.lotes.liberarReserva(reserva.dados.loteId, tx);
            await this.repository.expirar(reserva, tx);
            await this.auditoria.registrar(
              {
                usuarioId: null,
                entidadeTipo: 'Reserva',
                entidadeId: id,
                acao: 'EXPIRAR',
                valorAnterior: { status: 'ATIVA' },
                valorNovo: { status: 'EXPIRADA' },
              },
              tx,
            );
            return true;
          });
          if (alterada) expiradas++;
        } catch {
          falhas++;
        }
      }
      aposId = ids[ids.length - 1];
    }
    return { expiradas, falhas };
  }
}
