import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { toSkipTake } from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Usuario } from '../../domain/models/usuario.entity.js';
import type {
  GestaoUsuarioRepository,
  FiltrosUsuarios,
} from '../../domain/repositories/gestao-usuario.repository.interface.js';
@Injectable()
export class PrismaGestaoUsuarioRepository implements GestaoUsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}
  async bloquearGestao(tx: PrismaTransaction): Promise<void> {
    // Serializa as alterações administrativas, inclusive rebaixamentos concorrentes.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(10, 10)`;
  }
  countAdministradores(tx: PrismaTransaction): Promise<number> {
    return tx.usuario.count({
      where: { ativo: true, perfil: { codigo: 'ADMINISTRADOR' } },
    });
  }
  async list(filtros: FiltrosUsuarios) {
    const where = {
      ativo: filtros.ativo,
      ...(filtros.perfil ? { perfil: { codigo: filtros.perfil } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        include: { perfil: true },
        ...toSkipTake(filtros),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return {
      items: rows.map((row) =>
        Usuario.restore({ ...row, perfil: row.perfil.codigo }),
      ),
      total,
    };
  }
  async save(usuario: Usuario, tx: PrismaTransaction): Promise<void> {
    const { id, nome, email, perfil } = usuario.dados;
    const papel = await tx.perfil.findUnique({ where: { codigo: perfil } });
    if (!papel)
      throw new NotFoundError('PERFIL_NAO_ENCONTRADO', 'Perfil não encontrado');
    const data = { nome, email, perfilId: papel.id, ativo: usuario.ativo };
    await tx.usuario.upsert({
      where: { id },
      create: { id, ...data, senhaHash: usuario.senhaHash },
      update: data,
    });
  }
}
