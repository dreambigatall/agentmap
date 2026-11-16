import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Env } from './config/env';
import { APP_VERSION } from './version';

export const API_PREFIX = 'api';

/** Settings shared by the running server, the tests and the OpenAPI export. */
export function configureApp(
  app: INestApplication,
  env: Pick<Env, 'WEB_ORIGIN'> & Partial<Pick<Env, 'TRUST_PROXY_HOPS'>>,
): void {
  app.setGlobalPrefix(API_PREFIX);
  // Behind Vercel or another proxy, read the visitor's address from X-Forwarded-For
  // so rate limits apply per visitor, not per proxy.
  (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set(
    'trust proxy',
    env.TRUST_PROXY_HOPS ?? 1,
  );
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Agentmap API')
    .setDescription('Design, review and sign off the workflows your AI agents follow.')
    .setVersion(APP_VERSION)
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
