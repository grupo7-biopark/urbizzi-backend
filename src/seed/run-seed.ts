import type { PrismaClient } from '../generated/prisma/client.js';
import type { Storage } from '../shared/application/storage/storage.interface.js';
import { Argon2PasswordHasher } from '../shared/infra/auth/argon2-password-hasher.js';
import { prepararMapaDev } from './development-map.js';
import { SeedRepository } from './seed.repository.js';
import { SeedError, type SeedConfig } from './seed-env.js';
export async function runSeed(
  prisma: PrismaClient,
  config: SeedConfig,
  storage?: Storage,
): Promise<void> {
  const repository = new SeedRepository(prisma),
    hasher = new Argon2PasswordHasher();
  const hashAdmin = await hasher.hash(config.SEED_ADMIN_SENHA);
  const hashDev =
    config.development && config.SEED_DEV_SENHA
      ? await hasher.hash(config.SEED_DEV_SENHA)
      : undefined;
  if (config.development && !(await repository.temPlantaDev())) {
    if (!storage)
      throw new SeedError(
        'O seed de desenvolvimento precisa do armazenamento de arquivos configurado.',
      );
    await prepararMapaDev(storage);
  }
  await repository.popular(config, hashAdmin, hashDev);
}
