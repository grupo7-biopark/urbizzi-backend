import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type {
  FiltrosPendenciasPainel,
  FiltrosResumoPainel,
  FiltrosVendasPainel,
  PainelPendencias,
  PainelResumo,
  PainelResumoLoteamento,
  PainelVendaDiaItem,
  PainelVendaMesItem,
  PainelVendaPeriodoItem,
  PainelVendaSemanaItem,
  PainelVendaVendedorItem,
  PainelVendas,
  PainelConsultaRepository,
  StatusLotePainel,
} from '../../domain/repositories/painel-consulta.repository.interface.js';

/**
 * Calcula a semana ISO 8601 no formato YYYY-Www, garantindo que o ano
 * seja o da quinta-feira daquela semana (ano da semana ISO).
 */
export function formatISOWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const isoYear = d.getUTCFullYear();
  const thursdayTime = d.getTime();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4 - jan4Day + 3));

  const weekNumber =
    1 + Math.round((thursdayTime - firstThursday.getTime()) / 604800000);
  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

@Injectable()
export class PrismaPainelConsultaRepository implements PainelConsultaRepository {
  constructor(private readonly prisma: PrismaService) {}

  formatISOWeek(date: Date): string {
    return formatISOWeek(date);
  }

  async obterResumo(filtros: FiltrosResumoPainel): Promise<PainelResumo> {
    const rows = await this.prisma.$queryRaw<
      {
        loteamentoId: string;
        loteamentoNome: string;
        status: StatusLotePainel | null;
        quantidade: number;
      }[]
    >(Prisma.sql`
      SELECT
        e.id AS "loteamentoId",
        e.nome AS "loteamentoNome",
        l.status,
        COUNT(l.id)::int AS quantidade
      FROM loteamentos e
      LEFT JOIN quadras q ON q.loteamento_id = e.id AND q.deleted_at IS NULL
      LEFT JOIN lotes l ON l.quadra_id = q.id AND l.deleted_at IS NULL
        ${filtros.dataDe ? Prisma.sql`AND l.created_at >= ${filtros.dataDe}` : Prisma.empty}
        ${filtros.dataAte ? Prisma.sql`AND l.created_at <= ${filtros.dataAte}` : Prisma.empty}
      WHERE e.deleted_at IS NULL
      ${filtros.loteamentoId ? Prisma.sql`AND e.id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
      GROUP BY e.id, e.nome, l.status
      ORDER BY e.nome, e.id
    `);

    const loteamentosMap = new Map<string, PainelResumoLoteamento>();

    const geral = {
      total: 0,
      disponivel: 0,
      reservado: 0,
      vendido: 0,
      bloqueado: 0,
      porStatus: {
        DISPONIVEL: 0,
        RESERVADO: 0,
        VENDIDO: 0,
        BLOQUEADO: 0,
      },
    };

    for (const row of rows) {
      if (!loteamentosMap.has(row.loteamentoId)) {
        loteamentosMap.set(row.loteamentoId, {
          id: row.loteamentoId,
          loteamentoId: row.loteamentoId,
          nome: row.loteamentoNome,
          total: 0,
          disponivel: 0,
          reservado: 0,
          vendido: 0,
          bloqueado: 0,
          porStatus: {
            DISPONIVEL: 0,
            RESERVADO: 0,
            VENDIDO: 0,
            BLOQUEADO: 0,
          },
        });
      }

      if (row.status && row.quantidade > 0) {
        const item = loteamentosMap.get(row.loteamentoId)!;
        item.porStatus[row.status] += row.quantidade;
        item.total += row.quantidade;

        geral.porStatus[row.status] += row.quantidade;
        geral.total += row.quantidade;

        if (row.status === 'DISPONIVEL') {
          item.disponivel += row.quantidade;
          geral.disponivel += row.quantidade;
        } else if (row.status === 'RESERVADO') {
          item.reservado += row.quantidade;
          geral.reservado += row.quantidade;
        } else if (row.status === 'VENDIDO') {
          item.vendido += row.quantidade;
          geral.vendido += row.quantidade;
        } else if (row.status === 'BLOQUEADO') {
          item.bloqueado += row.quantidade;
          geral.bloqueado += row.quantidade;
        }
      }
    }

    const porLoteamento = Array.from(loteamentosMap.values());

    return {
      geral,
      porLoteamento,
      total: geral.total,
      disponivel: geral.disponivel,
      reservado: geral.reservado,
      vendido: geral.vendido,
      bloqueado: geral.bloqueado,
      porStatus: { ...geral.porStatus },
    };
  }

  async obterVendas(filtros: FiltrosVendasPainel): Promise<PainelVendas> {
    const agora = new Date();
    const inicioHoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
    );
    const diaSemana = agora.getUTCDay();
    const diffParaSegunda = (diaSemana + 6) % 7;
    const inicioSemana = new Date(
      Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate() - diffParaSegunda,
      ),
    );
    const inicioMes = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
    );

    const vendasCte = Prisma.sql`
      WITH vendas AS (
        SELECT
          r.id AS "reservaId",
          r.vendedor_id AS "vendedorId",
          u.nome AS "vendedorNome",
          r.updated_at AS "dataVenda",
          COALESCE(p.valor, l.valor, 0)::numeric(14, 2) AS valor,
          q.loteamento_id AS "loteamentoId"
        FROM reservas r
        JOIN lotes l ON l.id = r.lote_id
        JOIN quadras q ON q.id = l.quadra_id
        JOIN usuarios u ON u.id = r.vendedor_id
        LEFT JOIN LATERAL (
          SELECT p.valor
          FROM propostas p
          WHERE p.reserva_id = r.id AND p.status = 'APROVADA'
          ORDER BY p.data_decisao DESC NULLS LAST, p.created_at DESC
          LIMIT 1
        ) p ON true
        WHERE (
          r.status = 'CONVERTIDA'
          OR (l.status = 'VENDIDO' AND r.id = (
            SELECT r2.id FROM reservas r2 WHERE r2.lote_id = l.id ORDER BY r2.created_at DESC LIMIT 1
          ))
        )
        ${filtros.loteamentoId ? Prisma.sql`AND q.loteamento_id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
        ${filtros.vendedorId ? Prisma.sql`AND r.vendedor_id = ${filtros.vendedorId}::uuid` : Prisma.empty}
        ${filtros.dataDe ? Prisma.sql`AND r.updated_at >= ${filtros.dataDe}` : Prisma.empty}
        ${filtros.dataAte ? Prisma.sql`AND r.updated_at <= ${filtros.dataAte}` : Prisma.empty}

        UNION ALL

        SELECT
          NULL::uuid AS "reservaId",
          NULL::uuid AS "vendedorId",
          NULL::varchar AS "vendedorNome",
          l.updated_at AS "dataVenda",
          COALESCE(l.valor, 0)::numeric(14, 2) AS valor,
          q.loteamento_id AS "loteamentoId"
        FROM lotes l
        JOIN quadras q ON q.id = l.quadra_id
        WHERE l.status = 'VENDIDO'
          AND l.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.lote_id = l.id)
          ${filtros.vendedorId ? Prisma.sql`AND false` : Prisma.empty}
          ${filtros.loteamentoId ? Prisma.sql`AND q.loteamento_id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
          ${filtros.dataDe ? Prisma.sql`AND l.updated_at >= ${filtros.dataDe}` : Prisma.empty}
          ${filtros.dataAte ? Prisma.sql`AND l.updated_at <= ${filtros.dataAte}` : Prisma.empty}
      )
    `;

    const totaisQuery = this.prisma.$queryRaw<
      {
        total: number;
        valorTotal: string;
        vendasHoje: number;
        vendasSemana: number;
        vendasMes: number;
      }[]
    >(Prisma.sql`
      ${vendasCte}
      SELECT
        COUNT(*)::int AS "total",
        ROUND(COALESCE(SUM(valor), 0), 2)::text AS "valorTotal",
        COUNT(CASE WHEN "dataVenda" >= ${inicioHoje} THEN 1 END)::int AS "vendasHoje",
        COUNT(CASE WHEN "dataVenda" >= ${inicioSemana} THEN 1 END)::int AS "vendasSemana",
        COUNT(CASE WHEN "dataVenda" >= ${inicioMes} THEN 1 END)::int AS "vendasMes"
      FROM vendas
    `);

    const porDiaQuery = this.prisma.$queryRaw<PainelVendaDiaItem[]>(
      Prisma.sql`
        ${vendasCte}
        SELECT
          to_char("dataVenda" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "data",
          COUNT(*)::int AS "quantidade",
          ROUND(COALESCE(SUM(valor), 0), 2)::text AS "valorTotal"
        FROM vendas
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    );

    const porSemanaQuery = this.prisma.$queryRaw<PainelVendaSemanaItem[]>(
      Prisma.sql`
        ${vendasCte}
        SELECT
          to_char("dataVenda" AT TIME ZONE 'UTC', 'IYYY') || '-W' || to_char("dataVenda" AT TIME ZONE 'UTC', 'IW') AS "semana",
          COUNT(*)::int AS "quantidade",
          ROUND(COALESCE(SUM(valor), 0), 2)::text AS "valorTotal"
        FROM vendas
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    );

    const porMesQuery = this.prisma.$queryRaw<PainelVendaMesItem[]>(
      Prisma.sql`
        ${vendasCte}
        SELECT
          to_char("dataVenda" AT TIME ZONE 'UTC', 'YYYY-MM') AS "mes",
          COUNT(*)::int AS "quantidade",
          ROUND(COALESCE(SUM(valor), 0), 2)::text AS "valorTotal"
        FROM vendas
        GROUP BY 1
        ORDER BY 1 DESC
      `,
    );

    const porVendedorQuery = this.prisma.$queryRaw<PainelVendaVendedorItem[]>(
      Prisma.sql`
        ${vendasCte}
        SELECT
          "vendedorId"::text AS "vendedorId",
          "vendedorNome" AS "nome",
          COUNT(*)::int AS "quantidade",
          ROUND(COALESCE(SUM(valor), 0), 2)::text AS "valorTotal"
        FROM vendas
        WHERE "vendedorId" IS NOT NULL
        GROUP BY "vendedorId", "vendedorNome"
        ORDER BY "quantidade" DESC, "nome" ASC
      `,
    );

    const [totaisRows, porDia, porSemana, porMes, porVendedor] =
      await this.prisma.$transaction(
        [
          totaisQuery,
          porDiaQuery,
          porSemanaQuery,
          porMesQuery,
          porVendedorQuery,
        ],
        { isolationLevel: 'RepeatableRead' },
      );

    const totais = totaisRows[0] ?? {
      total: 0,
      valorTotal: '0.00',
      vendasHoje: 0,
      vendasSemana: 0,
      vendasMes: 0,
    };

    let porPeriodo: PainelVendaPeriodoItem[];
    if (filtros.agrupamento === 'mes') {
      porPeriodo = porMes.map((m) => ({
        periodo: m.mes,
        quantidade: m.quantidade,
        valorTotal: m.valorTotal,
      }));
    } else if (filtros.agrupamento === 'semana') {
      porPeriodo = porSemana.map((s) => ({
        periodo: s.semana,
        quantidade: s.quantidade,
        valorTotal: s.valorTotal,
      }));
    } else {
      porPeriodo = porDia.map((d) => ({
        periodo: d.data,
        quantidade: d.quantidade,
        valorTotal: d.valorTotal,
      }));
    }

    const totaisPeriodo = {
      dia: totais.vendasHoje,
      semana: totais.vendasSemana,
      mes: totais.vendasMes,
    };

    return {
      total: totais.total,
      valorTotal: totais.valorTotal,
      periodo: totaisPeriodo,
      resumo: totaisPeriodo,
      porPeriodo,
      porDia,
      porSemana,
      porMes,
      porVendedor,
    };
  }

  async obterPendencias(
    filtros: FiltrosPendenciasPainel,
  ): Promise<PainelPendencias> {
    const agora = new Date();

    const reservasQuery = this.prisma.$queryRaw<
      { ativas: number; vencendoEmBreve: number }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS ativas,
        COUNT(CASE WHEN r.data_vencimento <= ${filtros.limiteBreve} AND r.data_vencimento >= ${agora} THEN 1 END)::int AS "vencendoEmBreve"
      FROM reservas r
      JOIN lotes l ON l.id = r.lote_id
      JOIN quadras q ON q.id = l.quadra_id
      WHERE r.status = 'ATIVA'
      ${filtros.vendedorId ? Prisma.sql`AND r.vendedor_id = ${filtros.vendedorId}::uuid` : Prisma.empty}
      ${filtros.loteamentoId ? Prisma.sql`AND q.loteamento_id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
      ${filtros.dataDe ? Prisma.sql`AND r.data_inicio >= ${filtros.dataDe}` : Prisma.empty}
      ${filtros.dataAte ? Prisma.sql`AND r.data_inicio <= ${filtros.dataAte}` : Prisma.empty}
    `);

    const propostasQuery = this.prisma.$queryRaw<
      { pendentes: number; atrasadas: number; emDia: number }[]
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS pendentes,
        COUNT(CASE WHEN p.prazo_limite < ${agora} THEN 1 END)::int AS atrasadas,
        COUNT(CASE WHEN p.prazo_limite >= ${agora} THEN 1 END)::int AS "emDia"
      FROM propostas p
      JOIN reservas r ON r.id = p.reserva_id
      JOIN lotes l ON l.id = r.lote_id
      JOIN quadras q ON q.id = l.quadra_id
      WHERE p.status = 'EM_ANALISE' AND p.data_encerramento IS NULL
      ${filtros.vendedorId ? Prisma.sql`AND p.vendedor_id = ${filtros.vendedorId}::uuid` : Prisma.empty}
      ${filtros.loteamentoId ? Prisma.sql`AND q.loteamento_id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
      ${filtros.dataDe ? Prisma.sql`AND p.data_envio >= ${filtros.dataDe}` : Prisma.empty}
      ${filtros.dataAte ? Prisma.sql`AND p.data_envio <= ${filtros.dataAte}` : Prisma.empty}
    `);

    const [[reservasResult], [propostasResult]] =
      await this.prisma.$transaction([reservasQuery, propostasQuery], {
        isolationLevel: 'RepeatableRead',
      });
    const ativas = reservasResult?.ativas ?? 0;
    const vencendoEmBreve = reservasResult?.vencendoEmBreve ?? 0;
    const pendentes = propostasResult?.pendentes ?? 0;
    const atrasadas = propostasResult?.atrasadas ?? 0;
    const emDia = propostasResult?.emDia ?? 0;

    return {
      reservasAtivas: ativas,
      reservasVencendoEmBreve: vencendoEmBreve,
      propostasPendentes: pendentes,
      propostasAtrasadas: atrasadas,
      total: ativas + pendentes,
      reservas: {
        ativas,
        vencendoEmBreve,
      },
      propostas: {
        pendentes,
        atrasadas,
        emDia,
      },
    };
  }
}
