import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import { Usuario } from '../../domain/models/usuario.entity.js';
import type { UsuarioRepository } from '../../domain/repositories/usuario.repository.interface.js';
@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}
  async redefinirSenha(
    id: string,
    senhaHash: string,
    tx: PrismaTransaction,
  ): Promise<boolean> {
    const { count } = await tx.usuario.updateMany({
      where: { id, ativo: true },
      data: { senhaHash },
    });
    return count === 1;
  }
  async bloquearAutenticacao(id: string, tx: PrismaTransaction): Promise<void> {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${id}::uuid FOR UPDATE`;
  }
  async bloquearAutenticacaoPorEmail(
    email: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE email = ${email} FOR UPDATE`;
  }
  async findById(id: string, tx?: PrismaTransaction): Promise<Usuario | null> {
    return this.find({ id }, tx);
  }
  async findByEmail(
    email: string,
    tx?: PrismaTransaction,
  ): Promise<Usuario | null> {
    return this.find({ email }, tx);
  }
  private async find(
    where: { id: string } | { email: string },
    tx?: PrismaTransaction,
  ): Promise<Usuario | null> {
    const row = await (tx ?? this.prisma).usuario.findUnique({
      where,
      include: { perfil: true },
    });
    return row
      ? Usuario.restore({
          id: row.id,
          nome: row.nome,
          email: row.email,
          senhaHash: row.senhaHash,
          ativo: row.ativo,
          perfil: row.perfil.codigo,
        })
      : null;
  }
}
