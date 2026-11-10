import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type {
  EscopoLoteDetalhe,
  LoteDetalhe,
  LoteDetalheRepository,
} from '../../domain/repositories/lote-detalhe.repository.interface.js';

type DetalheRow = Omit<LoteDetalhe, 'lote'> & {
  lote: Omit<LoteDetalhe['lote'], 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  };
};

@Injectable()
export class PrismaLoteDetalheRepository implements LoteDetalheRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    id: string,
    escopo: EscopoLoteDetalhe,
  ): Promise<LoteDetalhe | null> {
    // Projeção de leitura entre módulos. O escopo entra antes dos agregados.
    const [row] = await this.prisma.$queryRaw<DetalheRow[]>`
      WITH lote AS (
        SELECT l.*, q.numero AS quadra_numero, e.id AS loteamento_id,
               e.nome AS loteamento_nome
        FROM lotes l
        JOIN quadras q ON q.id = l.quadra_id AND q.deleted_at IS NULL
        JOIN loteamentos e ON e.id = q.loteamento_id AND e.deleted_at IS NULL
        WHERE l.id = ${id}::uuid AND l.deleted_at IS NULL
      ), reservas_visiveis AS (
        SELECT r.*
        FROM reservas r JOIN lote l ON l.id = r.lote_id
        WHERE ${escopo.podeVerReservas}
          AND (${escopo.vendedorId ?? null}::uuid IS NULL
               OR r.vendedor_id = ${escopo.vendedorId ?? null}::uuid)
      ), reserva_atual AS (
        SELECT r.*
        FROM reservas_visiveis r JOIN lote l ON l.id = r.lote_id
        WHERE (l.status = 'RESERVADO' AND r.status = 'ATIVA')
           OR (l.status = 'VENDIDO' AND r.status = 'CONVERTIDA')
        ORDER BY r.updated_at DESC, r.id DESC
        LIMIT 1
      )
      SELECT
        jsonb_build_object(
          'id', l.id, 'loteamentoId', l.loteamento_id, 'quadraId', l.quadra_id,
          'numero', l.numero, 'areaM2', l.area_m2::text, 'valor', l.valor::text,
          'exibirValorPublico', l.exibir_valor_publico, 'status', l.status,
          'observacoes', l.observacoes, 'createdAt', l.created_at,
          'updatedAt', l.updated_at
        ) AS lote,
        jsonb_build_object('id', l.quadra_id, 'numero', l.quadra_numero) AS quadra,
        jsonb_build_object('id', l.loteamento_id, 'nome', l.loteamento_nome) AS loteamento,
        (
          SELECT jsonb_build_object(
            'id', r.id, 'status', r.status, 'dataInicio', r.data_inicio,
            'dataVencimento', r.data_vencimento,
            'cliente', jsonb_build_object(
              'id', c.id, 'nome', CASE WHEN c.deleted_at IS NULL THEN c.nome ELSE NULL END
            ),
            'vendedor', jsonb_build_object('id', u.id, 'nome', u.nome)
          )
          FROM reserva_atual r
          JOIN clientes c ON c.id = r.cliente_id
          JOIN usuarios u ON u.id = r.vendedor_id
        ) AS reserva,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', p.id, 'status', p.status, 'valor', p.valor::text,
            'dataEnvio', p.data_envio, 'prazoLimite', p.prazo_limite,
            'dataDecisao', p.data_decisao
          ) ORDER BY p.data_envio DESC, p.id DESC)
          FROM propostas p JOIN reserva_atual r ON r.id = p.reserva_id
        ), '[]'::jsonb) AS propostas,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', h.id, 'entidadeTipo', h.entidade_tipo, 'entidadeId', h.entidade_id,
            'acao', h.acao, 'createdAt', h.created_at
          ) ORDER BY h.created_at DESC, h.id DESC)
          FROM (
            SELECT h.id, h.entidade_tipo, h.entidade_id, h.acao, h.created_at
            FROM historico_auditoria h
            WHERE (${escopo.podeVerAuditoriaDoLote}
                   AND h.entidade_tipo = 'Lote' AND h.entidade_id = l.id)
               OR (h.entidade_tipo = 'Reserva' AND h.entidade_id IN (
                     SELECT id FROM reservas_visiveis
                   ))
               OR (h.entidade_tipo = 'Proposta' AND h.entidade_id IN (
                     SELECT p.id FROM propostas p JOIN reservas_visiveis r ON r.id = p.reserva_id
                   ))
            ORDER BY h.created_at DESC, h.id DESC
            LIMIT 20
          ) h
        ), '[]'::jsonb) AS historico
      FROM lote l
    `;
    if (!row) return null;
    return {
      ...row,
      lote: {
        ...row.lote,
        createdAt: new Date(row.lote.createdAt),
        updatedAt: new Date(row.lote.updatedAt),
      },
    };
  }
}
