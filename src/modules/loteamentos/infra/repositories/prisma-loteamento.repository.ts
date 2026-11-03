import { Injectable } from '@nestjs/common';
import type {
  Loteamento as LoteamentoRecord,
  Prisma,
} from '../../../../generated/prisma/client.js';
import {
  toSkipTake,
  type Page,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import type {
  LoteamentoFiltros,
  LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';

@Injectable()
export class PrismaLoteamentoRepository implements LoteamentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    id: string,
    tx?: PrismaTransaction,
  ): Promise<Loteamento | null> {
    const db = tx ?? this.prisma;
    const row = await db.loteamento.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toEntity(row) : null;
  }

  async existsByNome(nome: string, ignoreId?: string): Promise<boolean> {
    const count = await this.prisma.loteamento.count({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        deletedAt: null,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
    });
    return count > 0;
  }

  async findByNomes(
    nomes: string[],
    tx?: PrismaTransaction,
  ): Promise<Loteamento[]> {
    if (nomes.length === 0) return [];
    const db = tx ?? this.prisma;
    const rows = await db.loteamento.findMany({
      where: { nome: { in: nomes, mode: 'insensitive' }, deletedAt: null },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async hasQuadras(id: string, tx?: PrismaTransaction): Promise<boolean> {
    const db = tx ?? this.prisma;
    const count = await db.quadra.count({
      where: { loteamentoId: id, deletedAt: null },
    });
    return count > 0;
  }

  async list(
    filtros: LoteamentoFiltros,
    pagination: Pagination,
  ): Promise<Page<Loteamento>> {
    const where: Prisma.LoteamentoWhereInput = {
      deletedAt: null,
      ...(filtros.q && { nome: { contains: filtros.q, mode: 'insensitive' } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loteamento.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.prisma.loteamento.count({ where }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }

  async create(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.create({
      data: {
        id: loteamento.id,
        nome: loteamento.nome,
        descricao: loteamento.descricao,
        localizacao: loteamento.localizacao,
        createdAt: loteamento.createdAt,
        updatedAt: loteamento.updatedAt,
      },
    });
  }

  async update(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.update({
      where: { id: loteamento.id },
      data: {
        nome: loteamento.nome,
        descricao: loteamento.descricao,
        localizacao: loteamento.localizacao,
      },
    });
  }

  async delete(id: string, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toEntity(row: LoteamentoRecord): Loteamento {
    return Loteamento.restore({
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      localizacao: row.localizacao,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
