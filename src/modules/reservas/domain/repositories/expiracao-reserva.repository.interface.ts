import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Reserva } from '../models/reserva.entity.js';
export const EXPIRACAO_RESERVA_REPOSITORY = Symbol(
  'EXPIRACAO_RESERVA_REPOSITORY',
);
export interface ExpiracaoReservaRepository {
  candidatas(agora: Date, aposId?: string): Promise<string[]>;
  travarVencida(
    id: string,
    agora: Date,
    tx: PrismaTransaction,
  ): Promise<Reserva | null>;
  expirar(reserva: Reserva, tx: PrismaTransaction): Promise<void>;
}
