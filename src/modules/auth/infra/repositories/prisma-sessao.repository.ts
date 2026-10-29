import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import { Sessao } from '../../domain/models/sessao.entity.js';
import type { SessaoRepository } from '../../domain/repositories/sessao.repository.interface.js';
@Injectable()
export class PrismaSessaoRepository implements SessaoRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(sessao: Sessao): Promise<void> {
    await this.prisma.sessao.create({ data: this.data(sessao) });
  }
  async findValida(tokenHash: string): Promise<Sessao | null> {
    const row = await this.prisma.sessao.findFirst({
      where: { tokenHash, revogadoEm: null, expiraEm: { gt: new Date() } },
    });
    return row ? Sessao.restore(row) : null;
  }
  async rotate(tokenHash: string, nova: Sessao): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.sessao.updateMany({
        where: { tokenHash, revogadoEm: null, expiraEm: { gt: new Date() } },
        data: { revogadoEm: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.sessao.create({ data: this.data(nova) });
      return true;
    });
  }
  async revoke(tokenHash: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { tokenHash, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }
  private data(sessao: Sessao) {
    return {
      id: sessao.id,
      usuarioId: sessao.usuarioId,
      tokenHash: sessao.tokenHash,
      expiraEm: sessao.expiraEm,
    };
  }
}
