import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type {
  FiltrosReservas,
  ReservaResumo,
  ReservaConsultaRepository,
} from '../../domain/repositories/reserva-consulta.repository.interface.js';
@Injectable()
export class PrismaReservaConsultaRepository implements ReservaConsultaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(f: FiltrosReservas) {
    const [pagina] = await this.prisma.$queryRaw<
      { total: number; items: ReservaResumo[] }[]
    >(Prisma.sql`
   WITH filtradas AS (
    SELECT r.id, r.vendedor_id AS "vendedorId", r.status, r.data_inicio AS "dataInicio", r.data_vencimento AS "dataVencimento",
     jsonb_build_object('id', l.id, 'numero', l.numero, 'quadra', q.numero, 'loteamentoId', e.id, 'loteamento', e.nome) AS lote,
     jsonb_build_object('id', c.id, 'nome', CASE WHEN c.deleted_at IS NULL THEN c.nome ELSE NULL END) AS cliente,
     CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'status', p.status, 'valor', p.valor::text) END AS "propostaAtual"
    FROM reservas r JOIN lotes l ON l.id = r.lote_id JOIN quadras q ON q.id = l.quadra_id
    JOIN loteamentos e ON e.id = q.loteamento_id JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN LATERAL (SELECT p.id, p.status, p.valor FROM propostas p WHERE p.reserva_id = r.id ORDER BY p.data_envio DESC, p.id DESC LIMIT 1) p ON true
    WHERE true
    ${f.status?.length ? Prisma.sql`AND r.status::text IN (${Prisma.join(f.status)})` : Prisma.empty}
    ${f.vendedorId ? Prisma.sql`AND r.vendedor_id = ${f.vendedorId}::uuid` : Prisma.empty}
    ${f.loteamentoId ? Prisma.sql`AND e.id = ${f.loteamentoId}::uuid` : Prisma.empty}
    ${f.vencimentoDe ? Prisma.sql`AND r.data_vencimento >= ${new Date(f.vencimentoDe)}` : Prisma.empty}
    ${f.vencimentoAte ? Prisma.sql`AND r.data_vencimento <= ${new Date(f.vencimentoAte)}` : Prisma.empty}
   ), pagina AS (SELECT * FROM filtradas ORDER BY "dataVencimento", id LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize})
   SELECT (SELECT count(*)::int FROM filtradas) AS total, COALESCE(jsonb_agg(to_jsonb(pagina) ORDER BY "dataVencimento", id), '[]'::jsonb) AS items FROM pagina
  `);
    return pagina;
  }
}
