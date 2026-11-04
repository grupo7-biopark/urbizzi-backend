import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type {
  FiltrosMapa,
  ItemMapa,
  MapaConsultaRepository,
} from '../../domain/repositories/mapa-consulta.repository.interface.js';
@Injectable()
export class PrismaMapaConsultaRepository implements MapaConsultaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(plantaId: string, filtros: FiltrosMapa) {
    // Read model documentado: uma consulta paginada e contagem no mesmo snapshot.
    const [pagina] = await this.prisma.$queryRaw<
      { total: number; items: ItemMapa[] }[]
    >(Prisma.sql`
      WITH filtrados AS (
        SELECT m.id, m.lote_id AS "loteId", m.x, m.y, l.numero,
          q.id AS "quadraId", q.numero AS quadra,
          e.id AS "loteamentoId", e.nome AS loteamento,
          l.area_m2::text AS "areaM2", l.valor::text AS valor, l.status,
          l.exibir_valor_publico AS "exibirValorPublico", r.vendedor_id AS "vendedorId",
          EXISTS (SELECT 1 FROM propostas p WHERE p.reserva_id = r.id AND p.status = 'APROVADA') AS "propostaAprovada"
        FROM marcadores m JOIN lotes l ON l.id = m.lote_id AND l.deleted_at IS NULL
        JOIN quadras q ON q.id = l.quadra_id AND q.deleted_at IS NULL
        JOIN loteamentos e ON e.id = q.loteamento_id AND e.deleted_at IS NULL
        LEFT JOIN reservas r ON r.lote_id = l.id AND r.status = 'ATIVA'
        WHERE m.planta_id = ${plantaId}::uuid
          ${filtros.loteamentoId ? Prisma.sql`AND e.id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
          ${filtros.status?.length ? Prisma.sql`AND l.status::text IN (${Prisma.join(filtros.status)})` : Prisma.empty}
      ), pagina AS (
        SELECT * FROM filtrados ORDER BY id LIMIT ${filtros.pageSize} OFFSET ${(filtros.page - 1) * filtros.pageSize}
      )
      SELECT (SELECT count(*)::int FROM filtrados) AS total,
        COALESCE(jsonb_agg(to_jsonb(pagina) ORDER BY id), '[]'::jsonb) AS items FROM pagina
    `);
    return pagina;
  }
}
