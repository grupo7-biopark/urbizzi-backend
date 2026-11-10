import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { envSchema, type Env } from '../config/env.validation.js';
import { createS3Client } from '../shared/infra/storage/s3-client.js';
import { StorageService } from '../shared/infra/storage/storage.service.js';
import { parseSeedEnv, SeedError } from './seed-env.js';
import { runSeed } from './run-seed.js';

let prisma: PrismaClient | undefined, storage: StorageService | undefined;
try {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== '--development'))
    throw new SeedError(
      'Argumento de seed desconhecido. Use db:seed ou db:seed:dev.',
    );
  const config = parseSeedEnv(process.env, args.includes('--development'));
  if (config.development) {
    const parsed = envSchema
      .pick({
        S3_ENDPOINT: true,
        S3_PUBLIC_ENDPOINT: true,
        S3_REGION: true,
        S3_FORCE_PATH_STYLE: true,
        S3_ACCESS_KEY_ID: true,
        S3_SECRET_ACCESS_KEY: true,
        S3_BUCKET_ORIGINAIS: true,
        S3_BUCKET_TILES: true,
        S3_URL_EXPIRES_IN: true,
      })
      .safeParse(process.env);
    if (!parsed.success)
      throw new SeedError(
        'Confira a configuração S3 do seed de desenvolvimento no .env.example.',
      );
    const settings = new ConfigService<Env, true>(parsed.data);
    storage = new StorageService(
      createS3Client(settings),
      createS3Client(settings, true),
      settings,
    );
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
  });
  await runSeed(prisma, config, storage);
  console.info(
    config.development
      ? 'Seed de desenvolvimento concluído.'
      : 'Seed inicial concluído.',
  );
} catch (error) {
  console.error(
    error instanceof SeedError
      ? error.message
      : 'Não foi possível executar o seed. Confira conexão, migrations e armazenamento; nenhum segredo é registrado.',
  );
  process.exitCode = 1;
} finally {
  storage?.onModuleDestroy();
  try {
    await prisma?.$disconnect();
  } catch {
    console.error('Não foi possível encerrar a conexão do seed.');
    process.exitCode = 1;
  }
}
