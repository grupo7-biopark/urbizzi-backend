import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import type { ReservaRepository } from '../../domain/repositories/reserva.repository.interface.js';
@Injectable()
export class PrismaReservaRepository implements ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(reserva: Reserva, tx: PrismaTransaction): Promise<void> {
    try {
      await tx.reserva.create({ data: reserva.dados });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictError(
          'RESERVA_LOTE_JA_RESERVADO',
          'O lote já possui reserva ativa',
        );
      throw error;
    }
  }
  async findById(id: string, tx?: PrismaTransaction): Promise<Reserva | null> {
    if (tx)
      await tx.$queryRaw`SELECT id FROM reservas WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await (tx ?? this.prisma).reserva.findUnique({ where: { id } });
    return row ? Reserva.restore(row) : null;
  }
}
