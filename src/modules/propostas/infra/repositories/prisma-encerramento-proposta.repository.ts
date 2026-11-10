import { Injectable } from '@nestjs/common';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { EncerramentoPropostaRepository } from '../../domain/repositories/encerramento-proposta.repository.interface.js';
@Injectable()
export class PrismaEncerramentoPropostaRepository implements EncerramentoPropostaRepository {
  listarAbertas(reservaId: string, tx: PrismaTransaction) {
    return tx.proposta.findMany({
      where: {
        reservaId,
        dataEncerramento: null,
        status: { in: ['EM_ANALISE', 'APROVADA'] },
      },
      select: { id: true, status: true },
    });
  }
  async encerrar(
    ids: string[],
    data: Date,
    motivo: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    await tx.proposta.updateMany({
      where: { id: { in: ids }, dataEncerramento: null },
      data: { dataEncerramento: data, motivoEncerramento: motivo },
    });
  }
}
