import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
export const ENCERRAMENTO_PROPOSTA_REPOSITORY = Symbol(
  'ENCERRAMENTO_PROPOSTA_REPOSITORY',
);
export interface EncerramentoPropostaRepository {
  listarAbertas(
    reservaId: string,
    tx: PrismaTransaction,
  ): Promise<{ id: string; status: string }[]>;
  encerrar(
    ids: string[],
    data: Date,
    motivo: string,
    tx: PrismaTransaction,
  ): Promise<void>;
}
