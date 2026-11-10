import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Quadra as QuadraRecord,
} from '../../../../generated/prisma/client.js';
import {
  toSkipTake,
  type Page,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import type {
  QuadraFiltros,
  QuadraRepository,
} from '../../domain/repositories/quadra.repository.interface.js';

@Injectable()
export class PrismaQuadraRepository implements QuadraRepository {
  constructor(private readonly prisma: PrismaService) {}

  async travarExistentes(
    ids: string[],
    tx: PrismaTransaction,
  ): Promise<string[]> {
    if (!ids.length) return [];
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM quadras
      WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        AND deleted_at IS NULL ORDER BY id FOR UPDATE
    `);
    return rows.map((row) => row.id);
  }

  async findById(id: string, tx?: PrismaTransaction): Promise<Quadra | null> {
    const db = tx ?? this.prisma;
    if (tx)
      await tx.$queryRaw`SELECT id FROM quadras WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await db.quadra.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toEntity(row) : null;
  }

  async existsByNumero(
    loteamentoId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.quadra.count({
      where: {
        loteamentoId,
        numero: { equals: numero, mode: 'insensitive' },
        deletedAt: null,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
    });
    return count > 0;
  }

  async findByLoteamentoIds(
    loteamentoIds: string[],
    tx?: PrismaTransaction,
  ): Promise<Quadra[]> {
    if (loteamentoIds.length === 0) return [];
    const db = tx ?? this.prisma;
    const rows = await db.quadra.findMany({
      where: { loteamentoId: { in: loteamentoIds }, deletedAt: null },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async hasLotes(id: string, tx?: PrismaTransaction): Promise<boolean> {
    const db = tx ?? this.prisma;
    const count = await db.lote.count({
      where: { quadraId: id, deletedAt: null },
    });
    return count > 0;
  }

  async list(
    filtros: QuadraFiltros,
    pagination: Pagination,
  ): Promise<Page<Quadra>> {
    const where: Prisma.QuadraWhereInput = {
      loteamentoId: filtros.loteamentoId,
      deletedAt: null,
      ...(filtros.q && {
        numero: { contains: filtros.q, mode: 'insensitive' },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quadra.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.prisma.quadra.count({ where }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }

  async create(quadra: Quadra, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.quadra.create({
      data: {
        id: quadra.id,
        loteamentoId: quadra.loteamentoId,
        numero: quadra.numero,
        createdAt: quadra.createdAt,
        updatedAt: quadra.updatedAt,
      },
    });
  }

  async update(quadra: Quadra, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.quadra.update({
      where: { id: quadra.id },
      data: { numero: quadra.numero },
    });
  }

  async delete(id: string, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.quadra.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toEntity(row: QuadraRecord): Quadra {
    return Quadra.restore({
      id: row.id,
      loteamentoId: row.loteamentoId,
      numero: row.numero,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
