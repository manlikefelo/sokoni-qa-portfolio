import { z } from 'zod';

/**
 * Environment is validated at module load. The process refuses to boot with a
 * missing or malformed variable rather than failing later in a request.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Enables the test-support routes when set. Never set in production; the routes
  // refuse to act there regardless.
  TEST_SUPPORT_TOKEN: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;
export const isProduction = parsed.data.NODE_ENV === 'production';
