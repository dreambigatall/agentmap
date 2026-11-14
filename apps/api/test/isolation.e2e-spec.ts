/**
 * Workspace isolation: a member of one workspace can never read or change another.
 * This suite must cover every route under /w/:workspaceId. The last test fails when a
 * new route is added without being listed here.
 */
import type { INestApplication } from '@nestjs/common';
import { hasDatabase } from './db-env';
import {
  createTestApp,
  createWorkspace,
  signUp,
  verifyEmail,
  type TestUser,
} from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

describeDb('workspace isolation', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;
  let aliceWs: { id: string };
  let bobWs: { id: string };
  let aliceMemberId: string;
  let aliceInviteId: string;

  /** Every route under /w/:workspaceId, called as Bob against Alice's workspace. */
  const routes: Array<{ method: 'get' | 'patch' | 'post' | 'delete'; path: () => string; body?: object }> = [
    { method: 'get', path: () => `/api/w/${aliceWs.id}` },
    { method: 'patch', path: () => `/api/w/${aliceWs.id}`, body: { name: 'Taken over' } },
    { method: 'get', path: () => `/api/w/${aliceWs.id}/members` },
    { method: 'patch', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}`, body: { level: 'reviewer' } },
    { method: 'delete', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}` },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}/transfer-ownership` },
    { method: 'get', path: () => `/api/w/${aliceWs.id}/invites` },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/invites`, body: { email: 'x@example.test', level: 'editor' } },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/invites/${aliceInviteId}/resend` },
    { method: 'delete', path: () => `/api/w/${aliceWs.id}/invites/${aliceInviteId}` },
  ];

  beforeAll(async () => {
    app = await createTestApp();
    alice = await signUp(app, 'alice');
    bob = await signUp(app, 'bob');
    await verifyEmail(app, alice);
    await verifyEmail(app, bob);
    aliceWs = await createWorkspace(alice, 'Alice Co');
    bobWs = await createWorkspace(bob, 'Bob Co');

    const members = await alice.agent.get(`/api/w/${aliceWs.id}/members`).expect(200);
    aliceMemberId = members.body[0].id;
    const invite = await alice.agent
      .post(`/api/w/${aliceWs.id}/invites`)
      .send({ email: 'carol@example.test', level: 'editor' })
      .expect(201);
    aliceInviteId = invite.body.id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(routes.map((r) => [r.method.toUpperCase(), r] as const))(
    '%s %s from another workspace answers 404',
    async (_label, route) => {
      const call = bob.agent[route.method](route.path());
      const response = await (route.body ? call.send(route.body) : call);
      expect(response.status).toBe(404);
    },
  );

  it('cannot reach another workspace’s member or invite through its own workspace', async () => {
    await bob.agent
      .patch(`/api/w/${bobWs.id}/members/${aliceMemberId}`)
      .send({ level: 'reviewer' })
      .expect(404);
    await bob.agent.delete(`/api/w/${bobWs.id}/members/${aliceMemberId}`).expect(404);
    await bob.agent.post(`/api/w/${bobWs.id}/invites/${aliceInviteId}/resend`).expect(404);
    await bob.agent.delete(`/api/w/${bobWs.id}/invites/${aliceInviteId}`).expect(404);
  });

  it('left Alice’s data untouched', async () => {
    const ws = await alice.agent.get(`/api/w/${aliceWs.id}`).expect(200);
    expect(ws.body.name).toBe('Alice Co');
    const members = await alice.agent.get(`/api/w/${aliceWs.id}/members`).expect(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0].level).toBe('owner');
    const invites = await alice.agent.get(`/api/w/${aliceWs.id}/invites`).expect(200);
    expect(invites.body).toHaveLength(1);
  });

  it('a signed-out visitor gets 401 on workspace routes', async () => {
    const { default: request } = await import('supertest');
    await request(app.getHttpServer()).get(`/api/w/${aliceWs.id}`).expect(401);
  });

  it('covers every route under /w/:workspaceId', () => {
    const router = app.getHttpAdapter().getInstance()._router ?? app.getHttpAdapter().getInstance().router;
    const registered: string[] = router.stack
      .filter((layer: { route?: { path: string } }) => layer.route?.path.includes(':workspaceId'))
      .flatMap((layer: { route: { path: string; methods: Record<string, boolean> } }) =>
        Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${layer.route.path}`),
      );
    const covered = routes.map((r) => {
      const path = r
        .path()
        .replace(aliceWs.id, ':workspaceId')
        .replace(aliceMemberId, ':memberId')
        .replace(aliceInviteId, ':inviteId');
      return `${r.method.toUpperCase()} ${path}`;
    });
    expect(registered.length).toBeGreaterThan(0);
    expect(registered.filter((route) => !covered.includes(route))).toEqual([]);
  });
});
