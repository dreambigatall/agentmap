/**
 * Points the API tests at a separate schema, "app_test", in the same database,
 * so tests never touch real data. Loaded before every test file (jest setupFiles)
 * and by the global setup that applies migrations.
 */
import { config } from 'dotenv';
import { join } from 'node:path';

config({ path: join(__dirname, '..', '.env'), quiet: true } as Parameters<typeof config>[0]);

export const TEST_SCHEMA = 'app_test';

function withTestSchema(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('schema', TEST_SCHEMA);
  // Tests use the session pooler for everything: simpler, and fine at test volume.
  parsed.searchParams.delete('pgbouncer');
  return parsed.toString();
}

/** True when a database is configured; database tests are skipped otherwise. */
export const hasDatabase = Boolean(process.env.DIRECT_URL);

if (hasDatabase) {
  const testUrl = withTestSchema(process.env.DIRECT_URL!);
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-checks-0000';
process.env.RESEND_API_KEY = '';
