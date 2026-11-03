import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { TokenRecuperacaoSenha } from '../../domain/models/token-recuperacao-senha.entity.js';
import type { RecuperacaoSenhaRepository } from '../../domain/repositories/recuperacao-senha.repository.interface.js';
@Injectable()
export class PrismaRecuperacaoSenhaRepository implements RecuperacaoSenhaRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(token: TokenRecuperacaoSenha): Promise<void> {
    await this.prisma.tokenRecuperacaoSenha.create({
      data: {
        id: token.id,
        usuarioId: token.usuarioId,
        tokenHash: token.tokenHash,
        expiraEm: token.expiraEm,
      },
    });
  }
  async findByHash(
    tokenHash: string,
    tx: PrismaTransaction,
  ): Promise<TokenRecuperacaoSenha | null> {
    const row = await tx.tokenRecuperacaoSenha.findUnique({
      where: { tokenHash },
    });
    return row ? TokenRecuperacaoSenha.restore(row) : null;
  }
  async consumir(tokenHash: string, tx: PrismaTransaction): Promise<boolean> {
    const { count } = await tx.tokenRecuperacaoSenha.updateMany({
      where: { tokenHash, usadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date() },
    });
    return count === 1;
  }
  async invalidarTodos(
    usuarioId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    await tx.tokenRecuperacaoSenha.updateMany({
      where: { usuarioId, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    await tx.sessao.updateMany({
      where: { usuarioId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }
}
