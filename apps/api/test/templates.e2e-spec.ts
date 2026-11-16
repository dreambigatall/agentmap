import type { INestApplication } from '@nestjs/common';
import type { AgentDetail, NamedItem, SkillDetail } from '@skillflow/shared';
import { isReady } from '@skillflow/shared';
import { hasDatabase } from './db-env';
import { createTestApp, createWorkspace, lastTokenSentTo, signUp, uniqueEmail, verifyEmail, type TestUser } from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

/** Phase 6: starter templates and the setup checklist. */
describeDb('starter templates and setup progress', () => {
  let app: INestApplication;
  let owner: TestUser;
  let reviewer: TestUser;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signUp(app, 'p6-owner');
    await verifyEmail(app, owner);
    const ws = await createWorkspace(owner, 'Phase Six Co');
    base = `/api/w/${ws.id}`;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('starts with nothing set up', async () => {
    const board = (await owner.agent.get(`${base}/dashboard`).expect(200)).body;
    expect(board.setup).toEqual({ hasAgent: false, hasSkill: false, hasTeammate: false, hasSignoff: false, hasShare: false });
  });

  it('adds a template agent with ready Draft skills, reusing existing roles', async () => {
    const rolesBefore: NamedItem[] = (await owner.agent.get(`${base}/roles`).expect(200)).body;
    const agent: AgentDetail = (
      await owner.agent.post(`${base}/agents/from-template`).send({ key: 'operations' }).expect(201)
    ).body;
    expect(agent).toMatchObject({ shortName: 'OPS', fullName: 'Operations Agent' });
    expect(agent.capabilities.map((c) => c.name)).toEqual(['Purchasing', 'Contracts']);
    expect(agent.capabilities.flatMap((c) => c.skills.map((s) => s.status))).toEqual(['draft', 'draft', 'draft']);

    const rolesAfter: NamedItem[] = (await owner.agent.get(`${base}/roles`).expect(200)).body;
    const names = rolesAfter.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    // Team lead, Department manager and Finance are default roles, so none were added.
    expect(rolesAfter).toHaveLength(rolesBefore.length);

    const skill: SkillDetail = (
      await owner.agent.get(`${base}/skills/${agent.capabilities[0].skills[0].id}`).expect(200)
    ).body;
    expect(skill).toMatchObject({ name: 'Purchase request', version: 1 });
    expect(isReady(skill)).toBe(true);
    expect(skill.steps.filter((s) => s.isApproval).every((s) => s.roleId)).toBe(true);
    const versions = (await owner.agent.get(`${base}/skills/${skill.id}/versions`).expect(200)).body;
    expect(versions[0].note).toBe('Created from the Operations template');
    // A template skill can move to Defined straight away.
    await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(200);
  });

  it('creates roles a template needs that the workspace lacks', async () => {
    await owner.agent.post(`${base}/agents/from-template`).send({ key: 'sales' }).expect(201);
    const roles: NamedItem[] = (await owner.agent.get(`${base}/roles`).expect(200)).body;
    expect(roles.map((r) => r.name)).toEqual(expect.arrayContaining(['Account executive', 'Sales manager']));
  });

  it('refuses unknown templates and non-editors', async () => {
    await owner.agent.post(`${base}/agents/from-template`).send({ key: 'nope' }).expect(400);
    const email = uniqueEmail('p6-reviewer');
    await owner.agent.post(`${base}/invites`).send({ email, level: 'reviewer' }).expect(201);
    reviewer = await signUp(app, 'p6-reviewer', { email, inviteToken: lastTokenSentTo(app, email) });
    await reviewer.agent.post(`${base}/agents/from-template`).send({ key: 'finance' }).expect(403);
  });

  it('tracks setup progress', async () => {
    const board = (await owner.agent.get(`${base}/dashboard`).expect(200)).body;
    expect(board.setup).toEqual({ hasAgent: true, hasSkill: true, hasTeammate: true, hasSignoff: false, hasShare: false });
  });
});
