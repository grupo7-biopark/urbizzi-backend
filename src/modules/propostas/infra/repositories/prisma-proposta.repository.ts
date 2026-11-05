import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Proposta as PropostaRecord,
} from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import {
  toSkipTake,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Proposta } from '../../domain/models/proposta.entity.js';
import type { PropostaRepository } from '../../domain/repositories/proposta.repository.interface.js';
@Injectable()
export class PrismaPropostaRepository implements PropostaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(proposta: Proposta, tx: PrismaTransaction): Promise<void> {
    try {
      await tx.proposta.create({ data: proposta.dados });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictError(
          'PROPOSTA_EM_ANALISE',
          'A reserva já possui proposta em análise',
        );
      throw error;
    }
  }
  async findById(id: string): Promise<Proposta | null> {
    const row = await this.prisma.proposta.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }
  async findImpedimento(
    reservaId: string,
    tx: PrismaTransaction,
  ): Promise<'EM_ANALISE' | 'APROVADA' | null> {
    const row = await tx.proposta.findFirst({
      where: { reservaId, status: { in: ['EM_ANALISE', 'APROVADA'] } },
      select: { status: true },
    });
    return row?.status === 'APROVADA' ? 'APROVADA' : row ? 'EM_ANALISE' : null;
  }
  async list(reservaId: string, query: Pagination) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.proposta.findMany({
        where: { reservaId },
        ...toSkipTake(query),
        orderBy: [{ dataEnvio: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.proposta.count({ where: { reservaId } }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }
  private toEntity(row: PropostaRecord): Proposta {
    return Proposta.restore({
      id: row.id,
      reservaId: row.reservaId,
      vendedorId: row.vendedorId,
      valor: row.valor.toFixed(2),
      condicoes: row.condicoes,
      observacoes: row.observacoes,
      status: row.status,
      dataEnvio: row.dataEnvio,
      prazoLimite: row.prazoLimite,
    });
  }
}
