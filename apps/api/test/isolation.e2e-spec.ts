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
  let aliceRoleId: string;
  let aliceChannelId: string;
  let aliceAgentId: string;
  let aliceCapabilityId: string;
  let aliceSkillId: string;
  let bobCapabilityId: string;
  let aliceRequestId: string;
  let aliceFileId: string;
  let aliceCommentId: string;
  // No sign-off exists yet; the guard must refuse before the id is even looked up.
  const someSignoffId = '5f0c9a52-3c1d-4f7e-9b2a-7d6e5c4b3a21';
  const someShareId = '8a1d2c3b-4e5f-4a6b-9c7d-0e1f2a3b4c5d';

  const ws = () => `/api/w/${aliceWs.id}`;
  const skillBody = () => ({
    capabilityId: aliceCapabilityId,
    name: 'Taken over',
    startedByRoleId: null,
    trigger: '',
    steps: [],
    inputs: [],
    channels: [],
    deliverable: '',
    humanControl: '',
    runsAlongside: false,
    expectedVersion: 1,
  });

  /** Every route under /w/:workspaceId, called as Bob against Alice's workspace. */
  const routes: Array<{
    method: 'get' | 'patch' | 'post' | 'put' | 'delete';
    path: () => string;
    body?: () => object;
  }> = [
    { method: 'get', path: () => `/api/w/${aliceWs.id}` },
    { method: 'patch', path: () => `/api/w/${aliceWs.id}`, body: () => ({ name: 'Taken over' }) },
    { method: 'get', path: () => `/api/w/${aliceWs.id}/members` },
    { method: 'patch', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}`, body: () => ({ level: 'reviewer' }) },
    { method: 'delete', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}` },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/members/${aliceMemberId}/transfer-ownership` },
    { method: 'get', path: () => `/api/w/${aliceWs.id}/invites` },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/invites`, body: () => ({ email: 'x@example.test', level: 'editor' }) },
    { method: 'post', path: () => `/api/w/${aliceWs.id}/invites/${aliceInviteId}/resend` },
    { method: 'delete', path: () => `/api/w/${aliceWs.id}/invites/${aliceInviteId}` },
    { method: 'get', path: () => `${ws()}/roles` },
    { method: 'post', path: () => `${ws()}/roles`, body: () => ({ name: 'Intruder' }) },
    { method: 'patch', path: () => `${ws()}/roles/${aliceRoleId}`, body: () => ({ name: 'Renamed' }) },
    { method: 'delete', path: () => `${ws()}/roles/${aliceRoleId}` },
    { method: 'get', path: () => `${ws()}/channels` },
    { method: 'post', path: () => `${ws()}/channels`, body: () => ({ name: 'Intruder' }) },
    { method: 'patch', path: () => `${ws()}/channels/${aliceChannelId}`, body: () => ({ name: 'Renamed' }) },
    { method: 'delete', path: () => `${ws()}/channels/${aliceChannelId}` },
    { method: 'get', path: () => `${ws()}/agents` },
    { method: 'post', path: () => `${ws()}/agents`, body: () => ({ shortName: 'X', fullName: 'Intruder', color: 'teal' }) },
    { method: 'get', path: () => `${ws()}/agents/${aliceAgentId}` },
    { method: 'patch', path: () => `${ws()}/agents/${aliceAgentId}`, body: () => ({ fullName: 'Taken over' }) },
    { method: 'delete', path: () => `${ws()}/agents/${aliceAgentId}` },
    { method: 'post', path: () => `${ws()}/agents/${aliceAgentId}/capabilities`, body: () => ({ name: 'Intruder' }) },
    {
      method: 'put',
      path: () => `${ws()}/agents/${aliceAgentId}/capabilities/order`,
      body: () => ({ ids: [aliceCapabilityId] }),
    },
    { method: 'patch', path: () => `${ws()}/capabilities/${aliceCapabilityId}`, body: () => ({ name: 'Renamed' }) },
    { method: 'delete', path: () => `${ws()}/capabilities/${aliceCapabilityId}` },
    {
      method: 'put',
      path: () => `${ws()}/capabilities/${aliceCapabilityId}/skills/order`,
      body: () => ({ ids: [aliceSkillId] }),
    },
    { method: 'post', path: () => `${ws()}/skills`, body: () => ({ capabilityId: aliceCapabilityId, name: 'Intruder' }) },
    { method: 'get', path: () => `${ws()}/skills/${aliceSkillId}` },
    { method: 'put', path: () => `${ws()}/skills/${aliceSkillId}`, body: skillBody },
    { method: 'post', path: () => `${ws()}/skills/${aliceSkillId}/status`, body: () => ({ status: 'draft' }) },
    { method: 'delete', path: () => `${ws()}/skills/${aliceSkillId}` },
    { method: 'get', path: () => `${ws()}/skills/${aliceSkillId}/versions` },
    { method: 'get', path: () => `${ws()}/skills/${aliceSkillId}/versions/1` },
    { method: 'post', path: () => `${ws()}/skills/${aliceSkillId}/restore`, body: () => ({ number: 1, expectedVersion: 1 }) },
    { method: 'get', path: () => `${ws()}/capabilities/${aliceCapabilityId}/flow` },
    { method: 'get', path: () => `${ws()}/requests` },
    { method: 'post', path: () => `${ws()}/requests`, body: () => ({ agentId: aliceAgentId, name: 'Intruder' }) },
    { method: 'get', path: () => `${ws()}/requests/${aliceRequestId}` },
    {
      method: 'put',
      path: () => `${ws()}/requests/${aliceRequestId}`,
      body: () => ({
        name: 'Taken over', trigger: '', ownerRole: '', frequency: null, result: '', steps: [], inputs: [],
        rules: '', problems: '', keepHuman: '', expectedVersion: 1,
      }),
    },
    { method: 'post', path: () => `${ws()}/requests/${aliceRequestId}/status`, body: () => ({ status: 'declined' }) },
    { method: 'post', path: () => `${ws()}/requests/${aliceRequestId}/convert`, body: () => ({ capabilityId: aliceCapabilityId }) },
    { method: 'delete', path: () => `${ws()}/requests/${aliceRequestId}` },
    { method: 'post', path: () => `${ws()}/requests/${aliceRequestId}/files` },
    { method: 'get', path: () => `${ws()}/files/${aliceFileId}` },
    { method: 'delete', path: () => `${ws()}/files/${aliceFileId}` },
    { method: 'get', path: () => `${ws()}/comments?targetType=request&targetId=${aliceRequestId}` },
    {
      method: 'post',
      path: () => `${ws()}/comments`,
      body: () => ({ targetType: 'request', targetId: aliceRequestId, body: 'Intruder' }),
    },
    { method: 'patch', path: () => `${ws()}/comments/${aliceCommentId}`, body: () => ({ body: 'Edited' }) },
    { method: 'delete', path: () => `${ws()}/comments/${aliceCommentId}` },
    { method: 'post', path: () => `${ws()}/comments/${aliceCommentId}/resolve` },
    { method: 'post', path: () => `${ws()}/comments/${aliceCommentId}/reopen` },
    { method: 'get', path: () => `${ws()}/skills/${aliceSkillId}/signoffs` },
    { method: 'post', path: () => `${ws()}/skills/${aliceSkillId}/signoffs`, body: () => ({ ownerId: alice.me.id }) },
    { method: 'post', path: () => `${ws()}/signoffs/${someSignoffId}/decide`, body: () => ({ decision: 'approve' }) },
    { method: 'post', path: () => `${ws()}/signoffs/${someSignoffId}/cancel` },
    { method: 'get', path: () => `${ws()}/notifications` },
    { method: 'post', path: () => `${ws()}/notifications/read`, body: () => ({}) },
    { method: 'get', path: () => `${ws()}/agents/${aliceAgentId}/shares` },
    { method: 'post', path: () => `${ws()}/agents/${aliceAgentId}/shares` },
    { method: 'delete', path: () => `${ws()}/shares/${someShareId}` },
    { method: 'get', path: () => `${ws()}/skills/${aliceSkillId}/export` },
    { method: 'get', path: () => `${ws()}/dashboard` },
    { method: 'get', path: () => `${ws()}/search?q=alice` },
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

    const roles = await alice.agent.get(`${ws()}/roles`).expect(200);
    aliceRoleId = roles.body[0].id;
    const channels = await alice.agent.get(`${ws()}/channels`).expect(200);
    aliceChannelId = channels.body[0].id;
    const agent = await alice.agent
      .post(`${ws()}/agents`)
      .send({ shortName: 'ALC', fullName: 'Alice Agent', color: 'indigo' })
      .expect(201);
    aliceAgentId = agent.body.id;
    aliceCapabilityId = agent.body.capabilities[0].id;
    const skill = await alice.agent
      .post(`${ws()}/skills`)
      .send({ capabilityId: aliceCapabilityId, name: 'Alice skill' })
      .expect(201);
    aliceSkillId = skill.body.id;

    const bobAgent = await bob.agent
      .post(`/api/w/${bobWs.id}/agents`)
      .send({ shortName: 'BOB', fullName: 'Bob Agent', color: 'teal' })
      .expect(201);
    bobCapabilityId = bobAgent.body.capabilities[0].id;

    const request = await alice.agent
      .post(`${ws()}/requests`)
      .send({ agentId: aliceAgentId, name: 'Alice request' })
      .expect(201);
    aliceRequestId = request.body.id;
    const file = await alice.agent
      .post(`${ws()}/requests/${aliceRequestId}/files`)
      .attach('file', Buffer.from('private notes'), 'notes.txt')
      .expect(201);
    aliceFileId = file.body.id;
    const comment = await alice.agent
      .post(`${ws()}/comments`)
      .send({ targetType: 'request', targetId: aliceRequestId, body: 'Private thought' })
      .expect(201);
    aliceCommentId = comment.body.id;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(routes.map((r) => [r.method.toUpperCase(), r] as const))(
    '%s %s from another workspace answers 404',
    async (_label, route) => {
      const call = bob.agent[route.method](route.path());
      const response = await (route.body ? call.send(route.body()) : call);
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

    const own = `/api/w/${bobWs.id}`;
    await bob.agent.patch(`${own}/roles/${aliceRoleId}`).send({ name: 'Renamed' }).expect(404);
    await bob.agent.delete(`${own}/channels/${aliceChannelId}`).expect(404);
    await bob.agent.get(`${own}/agents/${aliceAgentId}`).expect(404);
    await bob.agent.patch(`${own}/capabilities/${aliceCapabilityId}`).send({ name: 'Renamed' }).expect(404);
    await bob.agent.get(`${own}/skills/${aliceSkillId}`).expect(404);
    await bob.agent.get(`${own}/skills/${aliceSkillId}/versions/1`).expect(404);
    await bob.agent.post(`${own}/skills/${aliceSkillId}/restore`).send({ number: 1, expectedVersion: 1 }).expect(404);
    await bob.agent.get(`${own}/capabilities/${aliceCapabilityId}/flow`).expect(404);
    await bob.agent.get(`${own}/requests/${aliceRequestId}`).expect(404);
    await bob.agent.get(`${own}/files/${aliceFileId}`).expect(404);
    await bob.agent.get(`${own}/comments?targetType=request&targetId=${aliceRequestId}`).expect(404);
    await bob.agent.patch(`${own}/comments/${aliceCommentId}`).send({ body: 'Edited' }).expect(404);
    await bob.agent.post(`${own}/comments`).send({ targetType: 'skill', targetId: aliceSkillId, body: 'Hi' }).expect(404);
    await bob.agent.get(`${own}/skills/${aliceSkillId}/signoffs`).expect(404);
    await bob.agent.post(`${own}/agents/${aliceAgentId}/shares`).expect(404);
    await bob.agent.get(`${own}/skills/${aliceSkillId}/export`).expect(404);
    const found = await bob.agent.get(`${own}/search?q=alice`).expect(200);
    expect(found.body.results).toEqual([]);
    const board = await bob.agent.get(`${own}/dashboard?agentId=${aliceAgentId}`).expect(200);
    expect(board.body.counts).toEqual({ draft: 0, defined: 0, in_build: 0, live: 0 });
    expect(board.body.recent).toEqual([]);
    await bob.agent.post(`${own}/requests`).send({ agentId: aliceAgentId, name: 'Sneaky' }).expect(400);
    await bob.agent.put(`${own}/skills/${aliceSkillId}`).send(skillBody()).expect(404);
    // Creating a skill in Alice's capability from Bob's workspace is refused too.
    await bob.agent
      .post(`${own}/skills`)
      .send({ capabilityId: aliceCapabilityId, name: 'Sneaky' })
      .expect(400);
    // A save in Bob's own skill may not point at Alice's role or channel.
    const bobSkill = await bob.agent
      .post(`${own}/skills`)
      .send({ capabilityId: bobCapabilityId, name: 'Bob skill' })
      .expect(201);
    await bob.agent
      .put(`${own}/skills/${bobSkill.body.id}`)
      .send({ ...skillBody(), capabilityId: bobCapabilityId, startedByRoleId: aliceRoleId })
      .expect(400);
    await bob.agent
      .put(`${own}/skills/${bobSkill.body.id}`)
      .send({ ...skillBody(), capabilityId: bobCapabilityId, channels: [{ channelId: aliceChannelId, usage: '' }] })
      .expect(400);
  });

  it('left Alice’s data untouched', async () => {
    const detail = await alice.agent.get(`/api/w/${aliceWs.id}`).expect(200);
    expect(detail.body.name).toBe('Alice Co');
    const agent = await alice.agent.get(`${ws()}/agents/${aliceAgentId}`).expect(200);
    expect(agent.body.fullName).toBe('Alice Agent');
    expect(agent.body.capabilities.map((c: { name: string }) => c.name)).toEqual(['General']);
    const skill = await alice.agent.get(`${ws()}/skills/${aliceSkillId}`).expect(200);
    expect(skill.body).toMatchObject({ name: 'Alice skill', version: 1, status: 'draft' });
    const roles = await alice.agent.get(`${ws()}/roles`).expect(200);
    expect(roles.body.map((r: { id: string }) => r.id)).toContain(aliceRoleId);
    const file = await alice.agent.get(`${ws()}/files/${aliceFileId}`).expect(200);
    expect(file.text ?? file.body.toString()).toBe('private notes');
    const comments = await alice.agent.get(`${ws()}/comments?targetType=request&targetId=${aliceRequestId}`).expect(200);
    expect(comments.body.map((c: { body: string }) => c.body)).toEqual(['Private thought']);
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
        .replace(aliceInviteId, ':inviteId')
        .replace(aliceRoleId, ':roleId')
        .replace(aliceChannelId, ':channelId')
        .replace(aliceAgentId, ':agentId')
        .replace(aliceCapabilityId, ':capabilityId')
        .replace(aliceSkillId, ':skillId')
        .replace(/\/versions\/1$/, '/versions/:number')
        .replace(aliceRequestId, ':requestId')
        .replace(aliceFileId, ':fileId')
        .replace(aliceCommentId, ':commentId')
        .replace(someSignoffId, ':signoffId')
        .replace(someShareId, ':shareId')
        .replace(/\?.*$/, '');
      return `${r.method.toUpperCase()} ${path}`;
    });
    expect(registered.length).toBeGreaterThan(0);
    expect(registered.filter((route) => !covered.includes(route))).toEqual([]);
  });
});
