import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  toSkipTake,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { Marcador } from '../../domain/models/marcador.entity.js';
import type { MarcadorRepository } from '../../domain/repositories/marcador.repository.interface.js';
@Injectable()
export class PrismaMarcadorRepository implements MarcadorRepository {
  constructor(private readonly prisma: PrismaService) {}
  copiar(
    origem: string,
    destino: string,
    mudouProporcao: boolean,
    tx: PrismaTransaction,
  ): Promise<number> {
    return tx.$executeRaw`INSERT INTO marcadores (id, planta_id, lote_id, x, y, revisar, updated_at)
      SELECT gen_random_uuid(), ${destino}::uuid, lote_id, x, y, revisar OR ${mudouProporcao}, now()
      FROM marcadores WHERE planta_id = ${origem}::uuid`;
  }
  async list(plantaId: string, pagination: Pagination) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.marcador.findMany({
        where: { plantaId },
        ...toSkipTake(pagination),
        orderBy: { id: 'asc' },
      }),
      this.prisma.marcador.count({ where: { plantaId } }),
    ]);
    return { items: rows.map(Marcador.restore), total };
  }
  async loteIds(plantaId: string): Promise<string[]> {
    return (
      await this.prisma.marcador.findMany({
        where: { plantaId },
        select: { loteId: true },
      })
    ).map((row) => row.loteId);
  }
  async find(plantaId: string, id: string, tx: PrismaTransaction) {
    await tx.$queryRaw`SELECT id FROM marcadores WHERE id = ${id}::uuid AND planta_id = ${plantaId}::uuid FOR UPDATE`;
    const row = await tx.marcador.findFirst({ where: { id, plantaId } });
    return row ? Marcador.restore(row) : null;
  }
  async createMany(
    marcadores: Marcador[],
    tx: PrismaTransaction,
  ): Promise<void> {
    try {
      await tx.marcador.createMany({
        data: marcadores.map((marcador) => marcador.dados),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictError(
          'MARCADOR_DUPLICADO',
          'O lote já possui marcador nesta planta',
        );
      throw error;
    }
  }
  async update(marcador: Marcador, tx: PrismaTransaction): Promise<void> {
    const { id, x, y, revisar } = marcador.dados;
    await tx.marcador.update({ where: { id }, data: { x, y, revisar } });
  }
  async delete(id: string, tx: PrismaTransaction): Promise<void> {
    await tx.marcador.delete({ where: { id } });
  }
}
