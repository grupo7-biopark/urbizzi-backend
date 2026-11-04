import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import type { StatusLote } from '../../domain/models/lote.entity.js';
import { Injectable } from '@nestjs/common';
import type {
  Lote as LoteRecord,
  Prisma,
} from '../../../../generated/prisma/client.js';
import {
  toSkipTake,
  type Page,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Lote } from '../../domain/models/lote.entity.js';
import type {
  LoteFiltros,
  LoteRepository,
} from '../../domain/repositories/lote.repository.interface.js';

// O loteamento vem da quadra, que pertence ao mesmo módulo
const INCLUDE_LOTEAMENTO = {
  quadra: { select: { loteamentoId: true } },
} as const;

type LoteComQuadra = LoteRecord & { quadra: { loteamentoId: string } };

@Injectable()
export class PrismaLoteRepository implements LoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async alterarStatus(
    id: string,
    esperado: StatusLote,
    novo: StatusLote,
    tx: PrismaTransaction,
  ): Promise<void> {
    const result = await tx.lote.updateMany({
      where: { id, status: esperado, deletedAt: null },
      data: {
        status: novo,
        ...(novo === 'RESERVADO' ? { teveReserva: true } : {}),
      },
    });
    if (result.count !== 1)
      throw new ConflictError(
        'LOTE_STATUS_ALTERADO',
        'O status do lote foi alterado por outra operação',
      );
  }

  async findById(id: string, tx?: PrismaTransaction): Promise<Lote | null> {
    const db = tx ?? this.prisma;
    if (tx)
      await tx.$queryRaw`SELECT id FROM lotes WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await db.lote.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE_LOTEAMENTO,
    });
    return row ? this.toEntity(row) : null;
  }

  async existsByNumero(
    quadraId: string,
    numero: string,
    ignoreId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.lote.count({
      where: {
        quadraId,
        numero: { equals: numero, mode: 'insensitive' },
        deletedAt: null,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
    });
    return count > 0;
  }

  async findByQuadraIds(
    quadraIds: string[],
    tx?: PrismaTransaction,
  ): Promise<Lote[]> {
    if (quadraIds.length === 0) return [];
    const db = tx ?? this.prisma;
    const rows = await db.lote.findMany({
      where: { quadraId: { in: quadraIds }, deletedAt: null },
      include: INCLUDE_LOTEAMENTO,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async list(
    filtros: LoteFiltros,
    pagination: Pagination,
  ): Promise<Page<Lote>> {
    const where: Prisma.LoteWhereInput = {
      ...(filtros.idsExcluir?.length
        ? { id: { notIn: filtros.idsExcluir } }
        : {}),
      deletedAt: null,
      ...(filtros.quadraId && { quadraId: filtros.quadraId }),
      ...(filtros.loteamentoId && {
        quadra: { loteamentoId: filtros.loteamentoId },
      }),
      ...(filtros.status && { status: { in: filtros.status } }),
      ...(filtros.q && {
        numero: { contains: filtros.q, mode: 'insensitive' },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lote.findMany({
        where,
        include: INCLUDE_LOTEAMENTO,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.prisma.lote.count({ where }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }

  async create(lote: Lote, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.lote.create({ data: this.toData(lote) });
  }

  async createMany(lotes: Lote[], tx?: PrismaTransaction): Promise<void> {
    if (lotes.length === 0) return;
    const db = tx ?? this.prisma;
    await db.lote.createMany({ data: lotes.map((lote) => this.toData(lote)) });
  }

  /** Grava só os campos do cadastro; o status muda pelos fluxos próprios. */
  async update(lote: Lote, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.lote.update({
      where: { id: lote.id },
      data: {
        numero: lote.numero,
        areaM2: lote.areaM2,
        valor: lote.valor,
        exibirValorPublico: lote.exibirValorPublico,
        observacoes: lote.observacoes,
      },
    });
  }

  async delete(id: string, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.lote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private toData(lote: Lote): Prisma.LoteCreateManyInput {
    return {
      id: lote.id,
      quadraId: lote.quadraId,
      numero: lote.numero,
      areaM2: lote.areaM2,
      valor: lote.valor,
      exibirValorPublico: lote.exibirValorPublico,
      status: lote.status,
      observacoes: lote.observacoes,
      teveReserva: lote.teveReserva,
      createdAt: lote.createdAt,
      updatedAt: lote.updatedAt,
    };
  }

  private toEntity(row: LoteComQuadra): Lote {
    return Lote.restore({
      id: row.id,
      quadraId: row.quadraId,
      loteamentoId: row.quadra.loteamentoId,
      numero: row.numero,
      areaM2: row.areaM2.toFixed(2),
      valor: row.valor?.toFixed(2) ?? null,
      exibirValorPublico: row.exibirValorPublico,
      status: row.status,
      observacoes: row.observacoes,
      teveReserva: row.teveReserva,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
