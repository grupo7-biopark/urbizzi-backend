import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type {
  HistoricoClienteRepository,
  HistoricoClienteItem,
} from '../../domain/repositories/historico-cliente.repository.interface.js';

@Injectable()
export class PrismaHistoricoClienteRepository implements HistoricoClienteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    clienteId: string,
    query: Pagination,
    vendedorId?: string,
  ): Promise<Page<HistoricoClienteItem> | null> {
    // Projeção de leitura documentada em docs/architecture.md. Total, página e
    // existência compartilham um snapshot; cadastros relacionados removidos
    // logicamente continuam identificando os negócios anteriores.
    const [pagina] = await this.prisma.$queryRaw<
      { existe: boolean; items: HistoricoClienteItem[]; total: number }[]
    >(Prisma.sql`
      WITH cliente AS (
        SELECT id FROM clientes
        WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
      ), reservas_cliente AS (
        SELECT r.id, r.data_inicio,
          jsonb_build_object(
            'id', r.id, 'status', r.status,
            'dataInicio', r.data_inicio, 'dataVencimento', r.data_vencimento,
            'lote', jsonb_build_object(
              'id', l.id, 'numero', l.numero, 'quadra', q.numero,
              'loteamentoId', e.id, 'loteamento', e.nome
            )
          ) AS resumo
        FROM reservas r
        JOIN cliente c ON c.id = r.cliente_id
        JOIN lotes l ON l.id = r.lote_id
        JOIN quadras q ON q.id = l.quadra_id
        JOIN loteamentos e ON e.id = q.loteamento_id
        WHERE true
          ${vendedorId ? Prisma.sql`AND r.vendedor_id = ${vendedorId}::uuid` : Prisma.empty}
      ), entradas AS (
        SELECT 'RESERVA'::text AS tipo, r.id, r.data_inicio AS data,
          r.resumo AS reserva, NULL::jsonb AS proposta
        FROM reservas_cliente r
        UNION ALL
        SELECT 'PROPOSTA', p.id, p.data_envio, r.resumo,
          jsonb_build_object(
            'id', p.id, 'valor', p.valor::text, 'status', p.status,
            'dataEnvio', p.data_envio, 'prazoLimite', p.prazo_limite,
            'decisao', CASE WHEN p.data_decisao IS NULL THEN NULL
              ELSE jsonb_build_object(
                'decididoPorId', p.decidido_por_id,
                'data', p.data_decisao, 'motivo', p.motivo_decisao
              )
            END
          )
        FROM propostas p
        JOIN reservas_cliente r ON r.id = p.reserva_id
      ), pagina AS (
        SELECT * FROM entradas ORDER BY data DESC, id DESC, tipo
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      )
      SELECT EXISTS(SELECT 1 FROM cliente) AS existe,
        (SELECT count(*)::int FROM entradas) AS total,
        COALESCE(
          jsonb_agg(to_jsonb(pagina) ORDER BY data DESC, id DESC, tipo),
          '[]'::jsonb
        ) AS items
      FROM pagina
    `);
    return pagina.existe ? { items: pagina.items, total: pagina.total } : null;
  }
}
