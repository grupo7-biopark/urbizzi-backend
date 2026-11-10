import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { Reserva } from '../../domain/models/reserva.entity.js';
import type { ReservaRepository } from '../../domain/repositories/reserva.repository.interface.js';
@Injectable()
export class PrismaReservaRepository implements ReservaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async renovar(
    reserva: Reserva,
    anterior: Date,
    usuarioId: string,
    tx: PrismaTransaction,
  ) {
    const { id, dataVencimento } = reserva.dados;
    await tx.reserva.update({ where: { id }, data: { dataVencimento } });
    await tx.reservaRenovacao.create({
      data: {
        reservaId: id,
        usuarioId,
        vencimentoAnterior: anterior,
        vencimentoNovo: dataVencimento,
      },
    });
  }

  async listarRenovacoes(id: string, skip: number, take: number) {
    const where = { reservaId: id };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.reservaRenovacao.findMany({
          where,
          skip,
          take,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          omit: { reservaId: true },
        }),
        this.prisma.reservaRenovacao.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }

  contarRenovacoes(id: string, tx: PrismaTransaction) {
    return tx.reservaRenovacao.count({ where: { reservaId: id } });
  }

  async cancelar(
    id: string,
    usuarioId: string,
    confirmar: boolean,
    tx: PrismaTransaction,
  ) {
    const where = {
      reservaId: id,
      status: {
        in: ['EM_ANALISE', 'APROVADA'] as ('EM_ANALISE' | 'APROVADA')[],
      },
    };
    if (!confirmar && (await tx.proposta.count({ where })))
      throw new ConflictError(
        'CONFIRMACAO_CANCELAMENTO_NECESSARIA',
        'Confirme o encerramento das propostas da reserva',
      );
    const propostas = confirmar
      ? await tx.proposta.updateManyAndReturn({
          where,
          data: {
            status: 'REJEITADA',
            decididoPorId: usuarioId,
            dataDecisao: new Date(),
            motivoDecisao: 'Reserva cancelada',
          },
          select: { id: true },
        })
      : [];
    await tx.reserva.update({ where: { id }, data: { status: 'CANCELADA' } });
    return propostas.map(({ id }) => id);
  }

  async create(reserva: Reserva, tx: PrismaTransaction): Promise<void> {
    try {
      await tx.reserva.create({ data: reserva.dados });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictError(
          'RESERVA_LOTE_JA_RESERVADO',
          'O lote já possui reserva ativa',
        );
      throw error;
    }
  }
  async travarAtivaPorLote(
    loteId: string,
    tx: PrismaTransaction,
  ): Promise<string | null> {
    const [reserva] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM reservas
      WHERE lote_id = ${loteId}::uuid AND status = 'ATIVA'
      FOR UPDATE
    `;
    return reserva?.id ?? null;
  }

  async findPropostaAprovada(
    id: string,
    tx: PrismaTransaction,
  ): Promise<string | null> {
    // Lida depois do lock de reserva compartilhado com a decisão e a expiração.
    const [proposta] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM propostas
      WHERE reserva_id = ${id}::uuid AND status = 'APROVADA'
      ORDER BY data_decisao DESC, id DESC
      LIMIT 1
    `;
    return proposta?.id ?? null;
  }

  async converter(id: string, tx: PrismaTransaction): Promise<void> {
    await tx.reserva.update({
      where: { id },
      data: { status: 'CONVERTIDA' },
    });
  }

  async findById(id: string, tx?: PrismaTransaction): Promise<Reserva | null> {
    if (tx)
      await tx.$queryRaw`SELECT id FROM reservas WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await (tx ?? this.prisma).reserva.findUnique({ where: { id } });
    return row ? Reserva.restore(row) : null;
  }
}
