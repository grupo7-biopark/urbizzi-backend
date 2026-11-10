import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Cliente as ClienteRecord,
} from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Pagination } from '../../../../shared/domain/pagination.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { Cliente } from '../../domain/models/cliente.entity.js';
import type { ClienteRepository } from '../../domain/repositories/cliente.repository.interface.js';
@Injectable()
export class PrismaClienteRepository implements ClienteRepository {
  constructor(private readonly prisma: PrismaService) {}
  private toEntity(row: ClienteRecord): Cliente {
    const {
      id,
      nome,
      documento,
      telefone,
      email,
      observacoes,
      createdAt,
      updatedAt,
    } = row;
    return Cliente.restore({
      id,
      nome,
      documento,
      telefone,
      email,
      observacoes,
      createdAt,
      updatedAt,
    });
  }
  async findById(id: string, tx?: PrismaTransaction) {
    if (tx)
      await tx.$queryRaw`SELECT id FROM clientes WHERE id = ${id}::uuid FOR UPDATE`;
    const row = await (tx ?? this.prisma).cliente.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? this.toEntity(row) : null;
  }
  async existsByDocumento(documento: string, ignoreId?: string) {
    return (
      (await this.prisma.cliente.count({
        where: {
          documento,
          deletedAt: null,
          ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
      })) > 0
    );
  }
  async list(q: string | undefined, pagination: Pagination) {
    const filtro = q?.trim();
    const texto = `%${(filtro ?? '').replace(/[\\%_]/g, '\\$&')}%`;
    const digits = filtro?.replace(/\D/g, '') ?? '';
    const where = filtro
      ? Prisma.sql`deleted_at IS NULL AND (unaccent(nome) ILIKE unaccent(${texto}) OR (${digits !== ''} AND documento LIKE ${`%${digits}%`}))`
      : Prisma.sql`deleted_at IS NULL`;
    return this.prisma.$transaction(
      async (tx) => {
        const [{ total }] = await tx.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total FROM clientes WHERE ${where}`;
        const ids = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM clientes WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${pagination.pageSize} OFFSET ${(pagination.page - 1) * pagination.pageSize}`;
        const rows = await tx.cliente.findMany({
          where: { id: { in: ids.map((row) => row.id) } },
        });
        const mapa = new Map(rows.map((row) => [row.id, row]));
        return {
          items: ids.map((row) => this.toEntity(mapa.get(row.id)!)),
          total,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async save(cliente: Cliente, tx: PrismaTransaction): Promise<void> {
    const { id, ...data } = cliente.dados;
    try {
      await tx.cliente.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictError(
          'CLIENTE_DOCUMENTO_DUPLICADO',
          'Já existe um cliente com esse documento',
        );
      throw error;
    }
  }
}
