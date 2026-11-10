import { z } from 'zod';
import { envSchema } from '../config/env.validation.js';

export class SeedError extends Error {}
const senha = z
  .string()
  .min(8)
  .max(1024)
  .refine((v) => v.trim().length >= 8);
const schema = z.object({
  DATABASE_URL: envSchema.shape.DATABASE_URL,
  SEED_ADMIN_NOME: z.string().trim().min(1).max(150).default('Administrador'),
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  SEED_ADMIN_SENHA: senha,
});
export type SeedConfig = z.infer<typeof schema> & {
  development: boolean;
  SEED_DEV_SENHA?: string;
};
export function parseSeedEnv(
  source: Record<string, unknown>,
  development = false,
): SeedConfig {
  const result = schema.safeParse(source);
  if (!result.success)
    throw new SeedError(
      `Configuração do seed inválida: ${[...new Set(result.error.issues.map((i) => i.path[0]))].join(', ')}. Confira o .env.example.`,
    );
  if (development && source.NODE_ENV !== 'development')
    throw new SeedError(
      'O seed de desenvolvimento exige NODE_ENV=development.',
    );
  const dev = senha.safeParse(source.SEED_DEV_SENHA);
  if (development && !dev.success)
    throw new SeedError('Defina SEED_DEV_SENHA com 8 a 1024 caracteres.');
  return {
    ...result.data,
    development,
    ...(development && dev.success ? { SEED_DEV_SENHA: dev.data } : {}),
  };
}
