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

  async update(planta: Planta, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.planta.update({
      where: { id: planta.id },
      data: {
        nome: planta.nome,
        status: planta.status,
        larguraPx: planta.larguraPx,
        alturaPx: planta.alturaPx,
        tilesPath: planta.tilesPath,
        maxZoom: planta.maxZoom,
        tamanhoTile: planta.tamanhoTile,
        mensagemErro: planta.mensagemErro,
        processamentoIniciadoEm: planta.processamentoIniciadoEm,
        ativa: planta.ativa,
        updatedAt: planta.updatedAt,
      },
    });
  }

  async reservarProxima(): Promise<Planta | null> {
    const [reservada] = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE plantas
      SET status = 'PROCESSANDO',
          processamento_iniciado_em = now(),
          mensagem_erro = NULL,
          updated_at = now()
      WHERE id = (
        SELECT id FROM plantas
        WHERE status = 'ENVIADA'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `;
    return reservada ? this.findById(reservada.id) : null;
  }

  async marcarInterrompidas(
    iniciadasAntesDe: Date,
    mensagem: string,
  ): Promise<number> {
    const { count } = await this.prisma.planta.updateMany({
      where: {
        status: 'PROCESSANDO',
        processamentoIniciadoEm: { lt: iniciadasAntesDe },
      },
      data: {
        status: 'ERRO',
        mensagemErro: mensagem,
        processamentoIniciadoEm: null,
      },
    });
    return count;
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
      tamanhoTile: row.tamanhoTile,
      mensagemErro: row.mensagemErro,
      processamentoIniciadoEm: row.processamentoIniciadoEm,
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
