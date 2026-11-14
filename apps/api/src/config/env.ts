import { z } from 'zod';

/**
 * Every environment variable the API reads, checked once at startup.
 * A missing or malformed value stops the API with a clear message
 * instead of failing later in the middle of a request.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is missing. Copy apps/api/.env.example to apps/api/.env.' })
    .startsWith('postgres', 'DATABASE_URL must be a postgres:// or postgresql:// connection string'),
  DIRECT_URL: z
    .string({ required_error: 'DIRECT_URL is missing. Copy apps/api/.env.example to apps/api/.env.' })
    .startsWith('postgres', 'DIRECT_URL must be a postgres:// or postgresql:// connection string'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is missing. See apps/api/.env.example for how to make one.' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  MAIL_FROM: z.string().min(3).default('Skillflow <onboarding@resend.dev>'),
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
