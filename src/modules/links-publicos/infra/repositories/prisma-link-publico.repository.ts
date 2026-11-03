import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import {
  toSkipTake,
  type Pagination,
} from '../../../../shared/domain/pagination.js';
import { LinkPublico } from '../../domain/models/link-publico.entity.js';
import type { LinkPublicoRepository } from '../../domain/repositories/link-publico.repository.interface.js';
@Injectable()
export class PrismaLinkPublicoRepository implements LinkPublicoRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(link: LinkPublico, tx: PrismaTransaction): Promise<void> {
    await tx.linkPublico.create({ data: link.dados });
  }
  async findById(id: string, tx?: PrismaTransaction) {
    const row = await (tx ?? this.prisma).linkPublico.findUnique({
      where: { id },
    });
    return row ? LinkPublico.restore(row) : null;
  }
  async list(criadoPorId: string | undefined, pagination: Pagination) {
    const where = criadoPorId ? { criadoPorId } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.linkPublico.findMany({
        where,
        ...toSkipTake(pagination),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.linkPublico.count({ where }),
    ]);
    return { items: rows.map(LinkPublico.restore), total };
  }
  async desativar(id: string, tx: PrismaTransaction): Promise<boolean> {
    return (
      (
        await tx.linkPublico.updateMany({
          where: { id, ativo: true },
          data: { ativo: false },
        })
      ).count === 1
    );
  }
  async registrarAcesso(token: string) {
    return this.prisma.$transaction(async (tx) => {
      if (
        (
          await tx.linkPublico.updateMany({
            where: { token, ativo: true },
            data: { acessos: { increment: 1 } },
          })
        ).count !== 1
      )
        return null;
      return LinkPublico.restore(
        await tx.linkPublico.findUniqueOrThrow({ where: { token } }),
      );
    });
  }
}
