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

@Injectable()
export class PrismaPainelConsultaRepository implements PainelConsultaRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    const vendasRaw = await this.prisma.$queryRaw<
      {
        reservaId: string | null;
        vendedorId: string | null;
        vendedorNome: string | null;
        dataVenda: Date;
        valor: string;
        loteamentoId: string;
      }[]
    >(Prisma.sql`
      WITH vendas_reservas AS (
        SELECT
          r.id AS "reservaId",
          r.vendedor_id AS "vendedorId",
          u.nome AS "vendedorNome",
          r.updated_at AS "dataVenda",
          COALESCE(p.valor, l.valor, 0)::text AS valor,
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
      ),
      vendas_diretas_lote AS (
        SELECT
          NULL::uuid AS "reservaId",
          NULL::uuid AS "vendedorId",
          NULL::varchar AS "vendedorNome",
          l.updated_at AS "dataVenda",
          COALESCE(l.valor, 0)::text AS valor,
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
      SELECT * FROM vendas_reservas
      UNION ALL
      SELECT * FROM vendas_diretas_lote
      ORDER BY "dataVenda" DESC
    `);

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

    let totalCentavos = 0n;
    let vendasHoje = 0;
    let vendasSemana = 0;
    let vendasMes = 0;

    const diasMap = new Map<string, { quantidade: number; centavos: bigint }>();
    const semanasMap = new Map<
      string,
      { quantidade: number; centavos: bigint }
    >();
    const mesesMap = new Map<
      string,
      { quantidade: number; centavos: bigint }
    >();
    const vendedoresMap = new Map<
      string,
      { nome: string; quantidade: number; centavos: bigint }
    >();

    for (const v of vendasRaw) {
      const centavos = this.parseCents(v.valor);
      totalCentavos += centavos;

      const dataVenda = new Date(v.dataVenda);
      if (dataVenda >= inicioHoje) {
        vendasHoje++;
      }
      if (dataVenda >= inicioSemana) {
        vendasSemana++;
      }
      if (dataVenda >= inicioMes) {
        vendasMes++;
      }

      const diaKey = dataVenda.toISOString().slice(0, 10);
      const diaItem = diasMap.get(diaKey) ?? { quantidade: 0, centavos: 0n };
      diaItem.quantidade++;
      diaItem.centavos += centavos;
      diasMap.set(diaKey, diaItem);

      const semanaKey = this.formatISOWeek(dataVenda);
      const semanaItem = semanasMap.get(semanaKey) ?? {
        quantidade: 0,
        centavos: 0n,
      };
      semanaItem.quantidade++;
      semanaItem.centavos += centavos;
      semanasMap.set(semanaKey, semanaItem);

      const mesKey = dataVenda.toISOString().slice(0, 7);
      const mesItem = mesesMap.get(mesKey) ?? { quantidade: 0, centavos: 0n };
      mesItem.quantidade++;
      mesItem.centavos += centavos;
      mesesMap.set(mesKey, mesItem);

      if (v.vendedorId) {
        const vendItem = vendedoresMap.get(v.vendedorId) ?? {
          nome: v.vendedorNome ?? 'Vendedor',
          quantidade: 0,
          centavos: 0n,
        };
        vendItem.quantidade++;
        vendItem.centavos += centavos;
        vendedoresMap.set(v.vendedorId, vendItem);
      }
    }

    const porDia: PainelVendaDiaItem[] = Array.from(diasMap.entries())
      .map(([data, item]) => ({
        data,
        quantidade: item.quantidade,
        valorTotal: this.formatCents(item.centavos),
      }))
      .sort((a, b) => b.data.localeCompare(a.data));

    const porSemana: PainelVendaSemanaItem[] = Array.from(semanasMap.entries())
      .map(([semana, item]) => ({
        semana,
        quantidade: item.quantidade,
        valorTotal: this.formatCents(item.centavos),
      }))
      .sort((a, b) => b.semana.localeCompare(a.semana));

    const porMes: PainelVendaMesItem[] = Array.from(mesesMap.entries())
      .map(([mes, item]) => ({
        mes,
        quantidade: item.quantidade,
        valorTotal: this.formatCents(item.centavos),
      }))
      .sort((a, b) => b.mes.localeCompare(a.mes));

    const porVendedor: PainelVendaVendedorItem[] = Array.from(
      vendedoresMap.entries(),
    )
      .map(([vendedorId, item]) => ({
        vendedorId,
        nome: item.nome,
        quantidade: item.quantidade,
        valorTotal: this.formatCents(item.centavos),
      }))
      .sort(
        (a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome),
      );

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
      dia: vendasHoje,
      semana: vendasSemana,
      mes: vendasMes,
    };

    return {
      total: vendasRaw.length,
      valorTotal: this.formatCents(totalCentavos),
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

    const [reservasResult] = await this.prisma.$queryRaw<
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

    const [propostasResult] = await this.prisma.$queryRaw<
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
      WHERE p.status = 'EM_ANALISE'
      ${filtros.vendedorId ? Prisma.sql`AND p.vendedor_id = ${filtros.vendedorId}::uuid` : Prisma.empty}
      ${filtros.loteamentoId ? Prisma.sql`AND q.loteamento_id = ${filtros.loteamentoId}::uuid` : Prisma.empty}
      ${filtros.dataDe ? Prisma.sql`AND p.data_envio >= ${filtros.dataDe}` : Prisma.empty}
      ${filtros.dataAte ? Prisma.sql`AND p.data_envio <= ${filtros.dataAte}` : Prisma.empty}
    `);

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

  private parseCents(valorStr: string | null | undefined): bigint {
    if (!valorStr) return 0n;
    const [inteiros, decimais = '00'] = valorStr.split('.');
    const dec2 = decimais.padEnd(2, '0').slice(0, 2);
    try {
      return BigInt(inteiros) * 100n + BigInt(dec2);
    } catch {
      return 0n;
    }
  }

  private formatCents(centavos: bigint): string {
    const abs = centavos < 0n ? -centavos : centavos;
    const sinal = centavos < 0n ? '-' : '';
    const inteiros = abs / 100n;
    const dec = (abs % 100n).toString().padStart(2, '0');
    return `${sinal}${inteiros.toString()}.${dec}`;
  }

  private formatISOWeek(date: Date): string {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThursday = d.getTime();
    d.setUTCMonth(0, 1);
    if (d.getUTCDay() !== 4) {
      d.setUTCMonth(0, 1 + ((4 - d.getUTCDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - d.getTime()) / 604800000);
    return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }
}
