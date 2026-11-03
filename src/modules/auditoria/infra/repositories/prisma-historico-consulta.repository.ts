import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import type {
  HistoricoConsultaRepository,
  HistoricoFiltros,
  HistoricoConsulta,
} from '../../domain/repositories/historico-consulta.repository.interface.js';
@Injectable()
export class PrismaHistoricoConsultaRepository implements HistoricoConsultaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(filtros: HistoricoFiltros, pagination: Pagination) {
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filtros.entidadeTipo)
      conditions.push(Prisma.sql`h.entidade_tipo = ${filtros.entidadeTipo}`);
    if (filtros.entidadeId)
      conditions.push(Prisma.sql`h.entidade_id = ${filtros.entidadeId}::uuid`);
    if (filtros.usuarioId)
      conditions.push(Prisma.sql`h.usuario_id = ${filtros.usuarioId}::uuid`);
    if (filtros.dataDe)
      conditions.push(Prisma.sql`h.created_at >= ${filtros.dataDe}`);
    if (filtros.dataAte)
      conditions.push(Prisma.sql`h.created_at <= ${filtros.dataAte}`);
    // Projeção de leitura polimórfica: propriedade vem do recurso, nunca do autor da auditoria.
    if (filtros.vendedorId)
      conditions.push(
        Prisma.sql`((h.entidade_tipo = 'Reserva' AND EXISTS (SELECT 1 FROM reservas r WHERE r.id = h.entidade_id AND r.vendedor_id = ${filtros.vendedorId}::uuid)) OR (h.entidade_tipo = 'Proposta' AND EXISTS (SELECT 1 FROM propostas p WHERE p.id = h.entidade_id AND p.vendedor_id = ${filtros.vendedorId}::uuid)))`,
      );
    const where = Prisma.join(conditions, ' AND ');
    return this.prisma.$transaction(
      async (tx) => {
        const [{ total }] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total FROM historico_auditoria h WHERE ${where}`;
        const rows = await tx.$queryRaw<
          (Omit<HistoricoConsulta, 'usuario'> & {
            usuarioId: string | null;
            usuarioNome: string | null;
          })[]
        >`SELECT h.id, h.usuario_id AS "usuarioId", u.nome AS "usuarioNome", h.entidade_tipo AS "entidadeTipo", h.entidade_id AS "entidadeId", h.acao, h.valor_anterior AS "valorAnterior", h.valor_novo AS "valorNovo", h.motivo, h.created_at AS "createdAt" FROM historico_auditoria h LEFT JOIN usuarios u ON u.id = h.usuario_id WHERE ${where} ORDER BY h.created_at DESC, h.id DESC LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`;
        return {
          items: rows.map(({ usuarioId, usuarioNome, ...row }) => ({
            ...row,
            usuario: usuarioId
              ? { id: usuarioId, nome: usuarioNome ?? 'Usuário' }
              : null,
          })),
          total,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
