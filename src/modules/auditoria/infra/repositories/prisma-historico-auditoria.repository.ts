import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { HistoricoAuditoria } from '../../domain/models/historico-auditoria.entity.js';
import type { HistoricoAuditoriaRepository } from '../../domain/repositories/historico-auditoria.repository.interface.js';
@Injectable()
export class PrismaHistoricoAuditoriaRepository implements HistoricoAuditoriaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    historico: HistoricoAuditoria,
    tx?: PrismaTransaction,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    await db.historicoAuditoria.create({
      data: {
        id: historico.id,
        usuarioId: historico.usuarioId,
        entidadeTipo: historico.entidadeTipo,
        entidadeId: historico.entidadeId,
        acao: historico.acao,
        valorAnterior: historico.valorAnterior ?? Prisma.DbNull,
        valorNovo: historico.valorNovo ?? Prisma.DbNull,
        motivo: historico.motivo,
        createdAt: historico.createdAt,
      },
    });
  }
}
