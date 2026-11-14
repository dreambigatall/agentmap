import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { hasDatabase, TEST_SCHEMA } from './db-env';

/** Brings the test schema up to date and empties it once before the whole run. */
export default async function globalSetup(): Promise<void> {
  if (!hasDatabase) {
    console.warn('\nNo DIRECT_URL configured: database tests will be skipped.\n');
    return;
  }

  const cwd = join(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env: process.env, stdio: 'pipe' });

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = '${TEST_SCHEMA}' AND tablename <> '_prisma_migrations'`,
    );
    if (tables.length > 0) {
      const list = tables.map((t) => `"${TEST_SCHEMA}"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
