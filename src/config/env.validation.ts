import { z } from 'zod';

export const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_EXPIRES_IN: z.coerce
    .number()
    .int()
    .min(3600)
    .max(2592000)
    .default(604800),
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
