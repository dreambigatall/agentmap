import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@skillflow/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

/** Uses a stand-in database, so it runs even without a database configured. */
async function createApp(databaseUp: boolean): Promise<INestApplication> {
  const prismaStub = {
    $queryRaw: jest.fn(() =>
      databaseUp ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('connection refused')),
    ),
    $disconnect: jest.fn(() => Promise.resolve()),
    onModuleDestroy: jest.fn(() => Promise.resolve()),
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, { WEB_ORIGIN: 'http://localhost:3000' });
  await app.init();
  return app;
}

describe('GET /api/health', () => {
  it('reports ok when the database answers, without signing in', async () => {
    const app = await createApp(true);
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
    await app.close();
  });

  it('still answers, as degraded, when the database is down', async () => {
    const app = await createApp(false);
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toMatchObject({ status: 'degraded', database: 'down' });
    await app.close();
  });
});
