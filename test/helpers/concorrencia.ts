import type { PrismaService } from '../../src/shared/infra/database/prisma.service.js';

export function criarSinal() {
  let liberar!: () => void;
  const promise = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  return { promise, liberar };
}

/** Observa a espera real no Postgres, sem depender de atraso fixo entre comandos. */
export async function aguardarBloqueio(prisma: PrismaService, tabela: string) {
  await expect
    .poll(
      async () => {
        const [row] = await prisma.$queryRaw<{ bloqueada: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE ${`%FROM ${tabela}%FOR UPDATE%`}) AS bloqueada
    `;
        return row.bloqueada;
      },
      { timeout: 3000, interval: 10 },
    )
    .toBe(true);
}
