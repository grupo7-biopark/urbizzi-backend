import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Reserva } from '../models/reserva.entity.js';
import type { RenovacaoDto } from '../models/renovacao.js';
export const RESERVA_REPOSITORY = Symbol('RESERVA_REPOSITORY');
export interface ReservaRepository {
  renovar(
    reserva: Reserva,
    anterior: Date,
    usuarioId: string,
    tx: PrismaTransaction,
  ): Promise<void>;
  listarRenovacoes(
    id: string,
    skip: number,
    take: number,
  ): Promise<{ items: RenovacaoDto[]; total: number }>;
  contarRenovacoes(id: string, tx: PrismaTransaction): Promise<number>;
  cancelar(
    id: string,
    usuarioId: string,
    confirmar: boolean,
    tx: PrismaTransaction,
  ): Promise<string[]>;
  create(reserva: Reserva, tx: PrismaTransaction): Promise<void>;
  findById(id: string, tx?: PrismaTransaction): Promise<Reserva | null>;
}
