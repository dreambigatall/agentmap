import type { INestApplication } from '@nestjs/common';
import type { AgentDetail, NamedItem, SkillDetail } from '@skillflow/shared';
import request from 'supertest';
import { hasDatabase } from './db-env';
import { createTestApp, createWorkspace, lastTokenSentTo, signUp, uniqueEmail, verifyEmail, type TestUser } from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

/** Phase 5: share links, export, the dashboard and search. */
describeDb('sharing, export, dashboard and search', () => {
  let app: INestApplication;
  let owner: TestUser;
  let reviewer: TestUser;
  let base: string;
  let agent: AgentDetail;
  let skill: SkillDetail;
  let roles: NamedItem[];
  let token: string;
  let shareId: string;

  const visitor = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signUp(app, 'p5-owner');
    await verifyEmail(app, owner);
    const ws = await createWorkspace(owner, 'Phase Five Co');
    base = `/api/w/${ws.id}`;
    const email = uniqueEmail('p5-reviewer');
    await owner.agent.post(`${base}/invites`).send({ email, level: 'reviewer' }).expect(201);
    reviewer = await signUp(app, 'p5-reviewer', { email, inviteToken: lastTokenSentTo(app, email) });

    roles = (await owner.agent.get(`${base}/roles`).expect(200)).body;
    const channels: NamedItem[] = (await owner.agent.get(`${base}/channels`).expect(200)).body;
    agent = (
      await owner.agent
        .post(`${base}/agents`)
        .send({ shortName: 'FIN', fullName: 'Finance Agent', color: 'amber' })
        .expect(201)
    ).body;
    const created = (
      await owner.agent
        .post(`${base}/skills`)
        .send({ capabilityId: agent.capabilities[0].id, name: 'Invoice matching' })
        .expect(201)
    ).body;
    skill = (
      await owner.agent
        .put(`${base}/skills/${created.id}`)
        .send({
          capabilityId: agent.capabilities[0].id,
          name: 'Invoice matching',
          startedByRoleId: null,
          trigger: 'A supplier invoice arrives',
          steps: [
            { roleId: null, text: 'Matches the invoice to its purchase order', isApproval: false, ifNo: '' },
            { roleId: roles[0].id, text: 'Approves the payment', isApproval: true, ifNo: 'Sends it back' },
          ],
          inputs: [{ label: 'Purchase orders', need: 'automatic' }],
          channels: [{ channelId: channels[0].id, usage: 'Sends the summary' }],
          deliverable: 'A matched invoice',
          humanControl: 'People approve every payment',
          runsAlongside: false,
          expectedVersion: 1,
        })
        .expect(200)
    ).body;
    await owner.agent
      .post(`${base}/comments`)
      .send({ targetType: 'skill', targetId: skill.id, body: 'Secret internal remark' })
      .expect(201);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  it('only editors manage share links', async () => {
    await reviewer.agent.post(`${base}/agents/${agent.id}/shares`).expect(403);
    const link = await owner.agent.post(`${base}/agents/${agent.id}/shares`).expect(201);
    token = link.body.token;
    shareId = link.body.id;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const list = await owner.agent.get(`${base}/agents/${agent.id}/shares`).expect(200);
    expect(list.body.map((l: { id: string }) => l.id)).toEqual([shareId]);
  });

  it('shows the agent to anyone with the link, without private details', async () => {
    const res = await visitor().get(`/api/share/${token}`).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.body.workspaceName).toBe('Phase Five Co');
    expect(res.body.agent.shortName).toBe('FIN');
    const shared = res.body.capabilities[0].skills[0];
    expect(shared.steps).toHaveLength(2);
    expect(shared.updatedBy).toBeNull();
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('Secret internal remark');
    expect(text).not.toContain('p5-owner');
    expect(text).not.toContain('@example.test');
  });

  it('answers 404 for a bad or turned-off link', async () => {
    await visitor().get('/api/share/not-a-token').expect(404);
    await visitor().get(`/api/share/${'x'.repeat(43)}`).expect(404);
    await owner.agent.delete(`${base}/shares/${shareId}`).expect(204);
    await visitor().get(`/api/share/${token}`).expect(404);
    await owner.agent.delete(`${base}/shares/${shareId}`).expect(404);
    const list = await owner.agent.get(`${base}/agents/${agent.id}/shares`).expect(200);
    expect(list.body).toEqual([]);
  });

  it('exports a skill as a file with role and channel names', async () => {
    const res = await reviewer.agent.get(`${base}/skills/${skill.id}/export`).expect(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="invoice-matching.skillflow.json"');
    expect(res.body.format).toBe('skillflow.skill/v1');
    expect(res.body.skill.steps.map((s: { doneBy: string }) => s.doneBy)).toEqual(['FIN', roles[0].name]);
    expect(res.body.skill.channels[0]).toEqual({ name: expect.any(String), usage: 'Sends the summary' });
  });

  it('counts skills and lists what waits on each person', async () => {
    await reviewer.agent.post(`${base}/requests`).send({ agentId: agent.id, name: 'Expense claims' }).expect(201);
    await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(200);
    await owner.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: reviewer.me.id }).expect(201);

    const forOwner = (await owner.agent.get(`${base}/dashboard`).expect(200)).body;
    expect(forOwner.counts).toEqual({ draft: 0, defined: 1, in_build: 0, live: 0 });
    expect(forOwner.toReview.map((r: { name: string }) => r.name)).toEqual(['Expense claims']);
    expect(forOwner.waitingOnMe).toEqual([]);
    expect(forOwner.recent[0]).toMatchObject({ kind: 'request', title: 'Expense claims' });

    const forReviewer = (await reviewer.agent.get(`${base}/dashboard?agentId=${agent.id}`).expect(200)).body;
    expect(forReviewer.toReview).toEqual([]);
    expect(forReviewer.myRequests.map((r: { name: string }) => r.name)).toEqual(['Expense claims']);
    expect(forReviewer.waitingOnMe).toMatchObject([{ skillId: skill.id, askedBy: 'p5-owner' }]);
  });

  it('searches agents, skills, steps and requests', async () => {
    const step = (await owner.agent.get(`${base}/search?q=PURCHASE ORDER`).expect(200)).body.results;
    expect(step).toMatchObject([{ type: 'step', skillId: skill.id, context: 'FIN · Invoice matching' }]);
    const many = (await owner.agent.get(`${base}/search?q=invoice`).expect(200)).body.results;
    expect(many.map((r: { type: string }) => r.type).sort()).toEqual(['skill', 'step']);
    const req = (await owner.agent.get(`${base}/search?q=expense`).expect(200)).body.results;
    expect(req).toMatchObject([{ type: 'request', skillId: null }]);
    await owner.agent.get(`${base}/search?q=a`).expect(400);
  });
});
