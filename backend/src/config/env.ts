import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform(v => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional().transform(v => v || undefined),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform(v => v.split(',').map(s => s.trim()).filter(Boolean)),
  SETUP_TOKEN: z.string().min(16).optional().or(z.literal('').transform(() => undefined)),
  JOBS_ENABLED: bool,
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment, check backend/.env:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
