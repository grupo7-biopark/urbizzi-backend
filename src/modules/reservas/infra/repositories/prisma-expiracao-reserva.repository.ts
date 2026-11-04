import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  Reserva,
  type ReservaProps,
} from '../../domain/models/reserva.entity.js';
import type { ExpiracaoReservaRepository } from '../../domain/repositories/expiracao-reserva.repository.interface.js';
@Injectable()
export class PrismaExpiracaoReservaRepository implements ExpiracaoReservaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async candidatas(agora: Date, aposId?: string): Promise<string[]> {
    // Projeção de elegibilidade documentada: proposta só é lida, nunca alterada.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
   SELECT r.id FROM reservas r WHERE r.status = 'ATIVA' AND r.data_vencimento <= ${agora}
   AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.reserva_id = r.id AND p.status = 'APROVADA')
   ${aposId ? Prisma.sql`AND r.id > ${aposId}::uuid` : Prisma.empty}
   ORDER BY r.id LIMIT 100
  `);
    return rows.map((r) => r.id);
  }
  async travarVencida(
    id: string,
    agora: Date,
    tx: PrismaTransaction,
  ): Promise<Reserva | null> {
    const bloqueadas = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM reservas WHERE id = ${id}::uuid FOR UPDATE SKIP LOCKED`;
    if (!bloqueadas.length) return null;
    // Novo snapshot após obter o bloqueio: revalida renovação, decisão e status.
    const [row] = await tx.$queryRaw<ReservaProps[]>`
   SELECT r.id, r.lote_id AS "loteId", r.cliente_id AS "clienteId", r.vendedor_id AS "vendedorId",
    r.data_inicio AS "dataInicio", r.data_vencimento AS "dataVencimento", r.status
   FROM reservas r WHERE r.id = ${id}::uuid AND r.status = 'ATIVA' AND r.data_vencimento <= ${agora}
   AND NOT EXISTS (SELECT 1 FROM propostas p WHERE p.reserva_id = r.id AND p.status = 'APROVADA')
  `;
    return row ? Reserva.restore(row) : null;
  }
  async expirar(reserva: Reserva, tx: PrismaTransaction): Promise<void> {
    await tx.reserva.update({
      where: { id: reserva.dados.id },
      data: {
        status: 'EXPIRADA',
        motivoEncerramento: 'Prazo de reserva vencido',
      },
    });
  }
}
