import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { toSkipTake } from '../../../../shared/domain/pagination.js';
import type {
  AreaGeografica,
  AreaGeograficaRepository,
} from '../../domain/repositories/area-geografica.repository.interface.js';

// A projeção exclui cadastros removidos em qualquer nível da hierarquia.
const projection = Prisma.sql`
 SELECT a.id, a.tipo, a.loteamento_id AS "loteamentoId", a.vertices,
 CASE WHEN a.tipo='LOTEAMENTO' THEN lt.nome::text WHEN a.tipo='QUADRA' THEN 'Quadra ' || q.numero ELSE 'Lote ' || l.numero || ' · Quadra ' || q.numero END AS nome,
 q.id AS "quadraId",
 l.status::text AS status
 FROM areas_geograficas a
 JOIN loteamentos lt ON lt.id=a.loteamento_id AND lt.deleted_at IS NULL
 LEFT JOIN lotes l ON l.id=a.id AND a.tipo='LOTE'
 LEFT JOIN quadras q ON q.id=CASE WHEN a.tipo='QUADRA' THEN a.id ELSE l.quadra_id END
 WHERE (a.tipo='LOTEAMENTO' OR (q.id IS NOT NULL AND q.deleted_at IS NULL AND (a.tipo='QUADRA' OR (l.deleted_at IS NULL AND l.id IS NOT NULL))))`;

@Injectable()
export class PrismaAreaGeograficaRepository implements AreaGeograficaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async lock(id: string, tx: PrismaTransaction) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 724001))::text`;
  }
  async scope(
    tipo: 'LOTEAMENTO' | 'LOTE' | 'QUADRA',
    id: string,
    tx: PrismaTransaction,
  ) {
    if (tipo === 'LOTEAMENTO')
      return (
        (
          await tx.loteamento.findFirst({
            where: { id, deletedAt: null },
            select: { id: true },
          })
        )?.id ?? null
      );
    if (tipo === 'QUADRA')
      return (
        (
          await tx.quadra.findFirst({
            where: { id, deletedAt: null, loteamento: { deletedAt: null } },
            select: { loteamentoId: true },
          })
        )?.loteamentoId ?? null
      );
    const lote = await tx.lote.findFirst({
      where: {
        id,
        deletedAt: null,
        quadra: { deletedAt: null, loteamento: { deletedAt: null } },
      },
      select: { quadra: { select: { loteamentoId: true } } },
    });
    return lote?.quadra.loteamentoId ?? null;
  }
  async list(id: string | undefined, pagination: Pagination) {
    const { skip, take } = toSkipTake(pagination);
    const filter = id
      ? Prisma.sql`AND a.loteamento_id=${id}::uuid`
      : Prisma.empty;
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.$queryRaw<AreaGeografica[]>(
          Prisma.sql`${projection} ${filter} ORDER BY CASE a.tipo WHEN 'LOTEAMENTO' THEN 0 WHEN 'QUADRA' THEN 1 ELSE 2 END,a.id LIMIT ${take} OFFSET ${skip}`,
        );
        const count = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total FROM (${projection} ${filter}) areas`,
        );
        return { items, total: Number(count[0].total) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async findById(id: string, tx?: PrismaTransaction) {
    const rows = await (tx ?? this.prisma).$queryRaw<AreaGeografica[]>(
      Prisma.sql`${projection} AND a.id=${id}::uuid`,
    );
    return rows[0] ?? null;
  }
  children(id: string, tx: PrismaTransaction) {
    return tx.$queryRaw<AreaGeografica[]>(
      Prisma.sql`${projection} AND a.tipo IN ('QUADRA','LOTE') AND a.loteamento_id=${id}::uuid ORDER BY a.id`,
    );
  }
  async save(
    area: Pick<AreaGeografica, 'id' | 'tipo' | 'loteamentoId' | 'vertices'>,
    tx: PrismaTransaction,
  ) {
    await tx.areaGeografica.upsert({
      where: { id: area.id },
      create: area,
      update: { vertices: area.vertices },
    });
  }
  async remove(id: string, tx: PrismaTransaction) {
    await tx.areaGeografica.deleteMany({ where: { id } });
  }
  async quadraDoLote(id: string, tx: PrismaTransaction) {
    return (
      (
        await tx.lote.findFirst({
          where: { id, deletedAt: null },
          select: { quadraId: true },
        })
      )?.quadraId ?? null
    );
  }
}
