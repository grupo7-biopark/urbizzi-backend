import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Reserva } from '../models/reserva.entity.js';
export const RESERVA_REPOSITORY = Symbol('RESERVA_REPOSITORY');
export interface ReservaRepository {
  create(reserva: Reserva, tx: PrismaTransaction): Promise<void>;
  findById(id: string, tx?: PrismaTransaction): Promise<Reserva | null>;
}
