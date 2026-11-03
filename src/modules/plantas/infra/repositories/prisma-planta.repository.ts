import { Injectable } from '@nestjs/common';
import type {
  Planta as PlantaRecord,
  Prisma,
} from '../../../../generated/prisma/client.js';
import {
  toSkipTake,
  type Page,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Planta } from '../../domain/models/planta.entity.js';
import type {
  PlantaFiltros,
  PlantaRepository,
} from '../../domain/repositories/planta.repository.interface.js';

/** Chave do advisory lock que serializa a numeração de versões. */
const LOCK_VERSAO = 7_301_001;

@Injectable()
export class PrismaPlantaRepository implements PlantaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: PrismaTransaction): Promise<Planta | null> {
    const db = tx ?? this.prisma;
    const row = await db.planta.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async list(
    filtros: PlantaFiltros,
    pagination: Pagination,
  ): Promise<Page<Planta>> {
    const where: Prisma.PlantaWhereInput = {
      ...(filtros.status && { status: { in: filtros.status } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.planta.findMany({
        where,
        orderBy: { versao: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.prisma.planta.count({ where }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }

  async proximaVersao(tx: PrismaTransaction): Promise<number> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_VERSAO})`;
    const { _max } = await tx.planta.aggregate({ _max: { versao: true } });
    return (_max.versao ?? 0) + 1;
  }

  async create(planta: Planta, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.planta.create({
      data: {
        id: planta.id,
        nome: planta.nome,
        versao: planta.versao,
        status: planta.status,
        gradeLinhas: planta.gradeLinhas,
        gradeColunas: planta.gradeColunas,
        originais: [...planta.originais],
        ativa: planta.ativa,
        criadoPorId: planta.criadoPorId,
        createdAt: planta.createdAt,
        updatedAt: planta.updatedAt,
      },
    });
  }

  private toEntity(row: PlantaRecord): Planta {
    return Planta.restore({
      id: row.id,
      nome: row.nome,
      versao: row.versao,
      status: row.status,
      larguraPx: row.larguraPx,
      alturaPx: row.alturaPx,
      tilesPath: row.tilesPath,
      maxZoom: row.maxZoom,
      gradeLinhas: row.gradeLinhas,
      gradeColunas: row.gradeColunas,
      originais: row.originais,
      ativa: row.ativa,
      criadoPorId: row.criadoPorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
