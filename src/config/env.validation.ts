import { z } from 'zod';

const endpoint = z.url({ protocol: /^https?$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash;
}, 'endpoint não pode conter credenciais, query ou fragmento');
const bucket = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/);

export const envSchema = z.object({
  S3_ENDPOINT: endpoint.default('http://localhost:3900'),
  S3_PUBLIC_ENDPOINT: endpoint.optional(),
  S3_REGION: z.string().min(1).default('garage'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_ORIGINAIS: bucket.default('plantas-originais'),
  S3_BUCKET_TILES: bucket.default('plantas-tiles'),
  S3_URL_EXPIRES_IN: z.coerce.number().int().min(1).max(604800).default(900),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined
        ? 'variável obrigatória não definida'
        : 'deve ser uma URL de conexão PostgreSQL (postgresql://...)',
  }),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }

  return result.data;
}
