import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
export const CONFIGURACAO_REPOSITORY = Symbol('CONFIGURACAO_REPOSITORY');
export type ConfiguracaoChave =
  'prazo_reserva_dias' | 'prazo_analise_dias_uteis';
export interface ConfiguracaoRepository {
  read(tx?: PrismaTransaction): Promise<{ chave: string; valor: string }[]>;
  lock(tx: PrismaTransaction): Promise<void>;
  set(
    chave: ConfiguracaoChave,
    valor: number,
    tx: PrismaTransaction,
  ): Promise<{ id: string; anterior: string | null }>;
}
