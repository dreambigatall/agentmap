import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from './common/auth.guard';
import { ConfigModule } from './config/config.module';
import { ENV, type Env } from './config/env';
import { AgentsModule } from './modules/agents/agents.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SkillsModule } from './modules/skills/skills.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET }),
    }),
    // 300 requests a minute per address overall; sign-in and similar routes set lower limits.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        skipIf: () => env.NODE_ENV === 'test',
      }),
    }),
    HealthModule,
    AuthModule,
    WorkspacesModule,
    SettingsModule,
    AgentsModule,
    SkillsModule,
    NotificationsModule,
    RequestsModule,
    CollaborationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
