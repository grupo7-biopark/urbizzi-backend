import type { PrismaService } from '../../src/shared/infra/database/prisma.service.js';

/**
 * Esvazia todas as tabelas do schema public (menos o controle de migrations
 * do Prisma). Use no beforeEach dos testes que gravam no banco.
 */
export async function limparBanco(prisma: PrismaService): Promise<void> {
  const tabelas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tabelas.length === 0) return;

  const lista = tabelas.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} CASCADE`);
}
