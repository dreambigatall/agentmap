import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hasDatabase } from './db-env';
import {
  createTestApp,
  createWorkspace,
  lastTokenSentTo,
  signUp,
  uniqueEmail,
  verifyEmail,
} from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

function cookieNames(response: request.Response): string[] {
  const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).map((c) => c.split('=')[0]);
}

function refreshCookie(response: request.Response): string {
  const raw = (response.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sf_refresh='));
  return raw!.split(';')[0];
}

describeDb('sign-up, sessions and passwords', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('signs up, sets the three session cookies and answers /me', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = uniqueEmail('dana');
    const res = await agent
      .post('/api/auth/sign-up')
      .send({ name: 'Dana', email: email.toUpperCase(), password: 'long-enough-pass' })
      .expect(201);
    expect(cookieNames(res).sort()).toEqual(['sf_access', 'sf_refresh', 'sf_session']);
    expect(res.body).toMatchObject({ email, emailVerified: false, workspaces: [] });

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('refuses a second account with the same email', async () => {
    const first = await signUp(app, 'erin');
    await request(app.getHttpServer())
      .post('/api/auth/sign-up')
      .send({ name: 'Erin 2', email: first.email, password: 'another-long-one' })
      .expect(409);
  });

  it('gives the same answer for a wrong email and a wrong password', async () => {
    const user = await signUp(app, 'finn');
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: user.email, password: 'not-the-password' })
      .expect(401);
    const wrongEmail = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: uniqueEmail('nobody'), password: 'not-the-password' })
      .expect(401);
    expect(wrongPassword.body.message).toBe(wrongEmail.body.message);
  });

  it('rotates the refresh token and ends the session when a spent one is replayed', async () => {
    const user = await signUp(app, 'gus');
    const server = app.getHttpServer();
    const signIn = await request(server)
      .post('/api/auth/sign-in')
      .send({ email: user.email, password: user.password })
      .expect(200);
    const first = refreshCookie(signIn);

    const rotated = await request(server).post('/api/auth/refresh').set('Cookie', first).expect(204);
    const second = refreshCookie(rotated);
    expect(second).not.toBe(first);

    // Replaying the first token after the grace window must revoke the whole sign-in.
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.refreshToken.updateMany({
      where: { usedAt: { not: null } },
      data: { usedAt: new Date(Date.now() - 60_000) },
    });
    await request(server).post('/api/auth/refresh').set('Cookie', first).expect(401);
    await request(server).post('/api/auth/refresh').set('Cookie', second).expect(401);
  });

  it('signs out', async () => {
    const user = await signUp(app, 'hana');
    await user.agent.post('/api/auth/sign-out').expect(204);
    await user.agent.get('/api/auth/me').expect(401);
  });

  it('verifies an email once', async () => {
    const user = await signUp(app, 'ivan');
    const token = lastTokenSentTo(app, user.email);
    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(204);
    await request(app.getHttpServer()).post('/api/auth/verify-email').send({ token }).expect(400);
    const me = await user.agent.get('/api/auth/me').expect(200);
    expect(me.body.emailVerified).toBe(true);
  });

  it('resets a password and signs out every session', async () => {
    const user = await signUp(app, 'jade');
    const server = app.getHttpServer();
    // Unknown and known emails get the same answer.
    await request(server).post('/api/auth/forgot-password').send({ email: uniqueEmail('ghost') }).expect(204);
    await request(server).post('/api/auth/forgot-password').send({ email: user.email }).expect(204);

    const token = lastTokenSentTo(app, user.email);
    await request(server)
      .post('/api/auth/reset-password')
      .send({ token, password: 'a-brand-new-password' })
      .expect(204);

    await user.agent.post('/api/auth/refresh').expect(401);
    await request(server)
      .post('/api/auth/sign-in')
      .send({ email: user.email, password: 'a-brand-new-password' })
      .expect(200);
  });
});

describeDb('workspaces, members and invites', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('runs the full invite flow with the right permissions', async () => {
    const owner = await signUp(app, 'olga');
    const ws = await createWorkspace(owner, 'Olga Labs');

    // Unverified owners cannot invite yet.
    await owner.agent
      .post(`/api/w/${ws.id}/invites`)
      .send({ email: uniqueEmail('x'), level: 'editor' })
      .expect(403);
    await verifyEmail(app, owner);

    // Invite someone who has no account: they sign up from the link.
    const reviewerEmail = uniqueEmail('rita');
    await owner.agent
      .post(`/api/w/${ws.id}/invites`)
      .send({ email: reviewerEmail, level: 'reviewer' })
      .expect(201);
    const token = lastTokenSentTo(app, reviewerEmail);

    const lookup = await request(app.getHttpServer()).get(`/api/invites/${token}`).expect(200);
    expect(lookup.body).toMatchObject({ workspaceName: 'Olga Labs', level: 'reviewer', hasAccount: false });

    const reviewer = await signUp(app, 'rita', { email: reviewerEmail, inviteToken: token });
    expect(reviewer.me.emailVerified).toBe(true);
    expect(reviewer.me.workspaces).toEqual([
      expect.objectContaining({ id: ws.id, level: 'reviewer' }),
    ]);

    // The link is spent.
    await request(app.getHttpServer()).get(`/api/invites/${token}`).expect(404);

    // A reviewer can read but not manage.
    await reviewer.agent.get(`/api/w/${ws.id}/members`).expect(200);
    await reviewer.agent
      .post(`/api/w/${ws.id}/invites`)
      .send({ email: uniqueEmail('y'), level: 'editor' })
      .expect(403);
    await reviewer.agent.patch(`/api/w/${ws.id}`).send({ name: 'Nope' }).expect(403);

    // Invite an existing account, accepted after signing in.
    const editor = await signUp(app, 'eddie');
    await owner.agent
      .post(`/api/w/${ws.id}/invites`)
      .send({ email: editor.email, level: 'admin' })
      .expect(201);
    const editorToken = lastTokenSentTo(app, editor.email);
    // Someone else holding the link cannot use it.
    await reviewer.agent.post('/api/invites/accept').send({ token: editorToken }).expect(403);
    const accepted = await editor.agent.post('/api/invites/accept').send({ token: editorToken }).expect(200);
    expect(accepted.body).toEqual({ workspaceSlug: ws.slug });

    // Owner changes levels and transfers ownership to the admin.
    const members = await owner.agent.get(`/api/w/${ws.id}/members`).expect(200);
    const byEmail = (email: string) => members.body.find((m: { email: string }) => m.email === email);
    const ownerMember = byEmail(owner.email);
    const adminMember = byEmail(editor.email);
    const reviewerMember = byEmail(reviewerEmail);

    await owner.agent
      .patch(`/api/w/${ws.id}/members/${reviewerMember.id}`)
      .send({ level: 'editor' })
      .expect(200);
    await owner.agent
      .patch(`/api/w/${ws.id}/members/${ownerMember.id}`)
      .send({ level: 'admin' })
      .expect(400);
    await owner.agent
      .post(`/api/w/${ws.id}/members/${reviewerMember.id}/transfer-ownership`)
      .expect(400);
    await owner.agent
      .post(`/api/w/${ws.id}/members/${adminMember.id}/transfer-ownership`)
      .expect(204);

    const after = await editor.agent.get(`/api/w/${ws.id}/members`).expect(200);
    const levels = Object.fromEntries(after.body.map((m: { email: string; level: string }) => [m.email, m.level]));
    expect(levels).toEqual({ [owner.email]: 'admin', [editor.email]: 'owner', [reviewerEmail]: 'editor' });

    // A member can leave; the owner cannot.
    await reviewer.agent.delete(`/api/w/${ws.id}/members/${reviewerMember.id}`).expect(204);
    await reviewer.agent.get(`/api/w/${ws.id}`).expect(404);
    await editor.agent.delete(`/api/w/${ws.id}/members/${adminMember.id}`).expect(400);
  });
});
