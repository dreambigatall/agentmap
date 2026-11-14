/**
 * Writes apps/api/openapi.json without starting a server or touching the database.
 * The web app generates its typed API client from this file (pnpm api:client).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApi, configureApp } from '../src/setup';

process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= 'openapi-export-only-not-a-real-secret-0000';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, { WEB_ORIGIN: 'http://localhost:3000' });
  await app.init();

  const target = join(__dirname, '..', 'openapi.json');
  writeFileSync(target, JSON.stringify(buildOpenApi(app), null, 2));
  await app.close();
  console.log(`OpenAPI written to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
