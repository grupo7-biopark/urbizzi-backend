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
  async findById(id: string): Promise<Usuario | null> {
    return this.find({ id });
  }
  async findByEmail(email: string): Promise<Usuario | null> {
    return this.find({ email });
  }
  private async find(
    where: { id: string } | { email: string },
  ): Promise<Usuario | null> {
    const row = await this.prisma.usuario.findUnique({
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
