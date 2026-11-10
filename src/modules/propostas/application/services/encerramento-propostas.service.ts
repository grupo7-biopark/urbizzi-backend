import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  ENCERRAMENTO_PROPOSTA_REPOSITORY,
  type EncerramentoPropostaRepository,
} from '../../domain/repositories/encerramento-proposta.repository.interface.js';
@Injectable()
export class EncerramentoPropostasService {
  constructor(
    @Inject(ENCERRAMENTO_PROPOSTA_REPOSITORY)
    private readonly repository: EncerramentoPropostaRepository,
    private readonly auditoria: AuditoriaService,
  ) {}
  /** Chamado somente depois do bloqueio da reserva, na mesma transação. */
  async porCancelamento(
    reservaId: string,
    usuarioId: string,
    confirmar: boolean,
    motivo: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const propostas = await this.repository.listarAbertas(reservaId, tx);
    if (!propostas.length) return;
    if (!confirmar)
      throw new ConflictError(
        'CONFIRMACAO_CANCELAMENTO_NECESSARIA',
        'Confirme o encerramento das propostas da reserva',
      );
    const data = new Date();
    await this.repository.encerrar(
      propostas.map((p) => p.id),
      data,
      motivo,
      tx,
    );
    for (const proposta of propostas)
      await this.auditoria.registrar(
        {
          usuarioId,
          entidadeTipo: 'Proposta',
          entidadeId: proposta.id,
          acao: 'ENCERRAR_POR_CANCELAMENTO',
          valorAnterior: { status: proposta.status, dataEncerramento: null },
          valorNovo: {
            status: proposta.status,
            dataEncerramento: data.toISOString(),
          },
          motivo,
        },
        tx,
      );
  }
}
