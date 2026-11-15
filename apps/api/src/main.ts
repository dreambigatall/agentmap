import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';
import { API_PREFIX, buildOpenApi, configureApp } from './setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  configureApp(app, env);
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApi(app));
  }

  await app.listen(env.API_PORT);
  Logger.log(`API listening on http://localhost:${env.API_PORT}/${API_PREFIX}`, 'Bootstrap');
}

bootstrap().catch((error: Error) => {
  // Configuration errors are written plainly so they are easy to act on.
  console.error(error.message);
  process.exit(1);
});
