import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Me } from '@skillflow/shared';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/modules/mail/mail.service';
import { configureApp } from '../src/setup';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, { WEB_ORIGIN: 'http://localhost:3000' });
  await app.init();
  return app;
}

export type Agent = ReturnType<typeof request.agent>;

export interface TestUser {
  agent: Agent;
  me: Me;
  email: string;
  password: string;
}

export function uniqueEmail(label: string): string {
  return `${label}-${randomBytes(4).toString('hex')}@example.test`;
}

/** Signs up a new person; the returned agent carries their session cookies. */
export async function signUp(
  app: INestApplication,
  label: string,
  extra: { inviteToken?: string; email?: string } = {},
): Promise<TestUser> {
  const agent = request.agent(app.getHttpServer());
  const email = extra.email ?? uniqueEmail(label);
  const password = 'correct-horse-battery';
  const response = await agent
    .post('/api/auth/sign-up')
    .send({ name: label, email, password, inviteToken: extra.inviteToken })
    .expect(201);
  return { agent, me: response.body as Me, email, password };
}

/** The token from the last email sent to an address, read from the in-memory outbox. */
export function lastTokenSentTo(app: INestApplication, email: string): string {
  const mail = app.get(MailService);
  const message = [...mail.outbox].reverse().find((m) => m.to === email);
  if (!message?.link) throw new Error(`No email with a link was sent to ${email}`);
  const url = new URL(message.link);
  return url.searchParams.get('token') ?? url.pathname.split('/').pop()!;
}

export async function verifyEmail(app: INestApplication, user: TestUser): Promise<void> {
  await user.agent
    .post('/api/auth/verify-email')
    .send({ token: lastTokenSentTo(app, user.email) })
    .expect(204);
}

export async function createWorkspace(user: TestUser, name: string): Promise<{ id: string; slug: string }> {
  const response = await user.agent.post('/api/workspaces').send({ name }).expect(201);
  return response.body as { id: string; slug: string };
}
