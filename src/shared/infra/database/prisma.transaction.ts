import type { Prisma } from '../../../generated/prisma/client.js';

/**
 * Cliente recebido dentro de `prismaService.$transaction(async (tx) => ...)`.
 * Repositórios e serviços exportados que participam de transações aceitam
 * `tx?: PrismaTransaction` como último parâmetro (ver docs/database.md).
 */
export type PrismaTransaction = Prisma.TransactionClient;
