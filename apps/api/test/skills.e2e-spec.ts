import type { INestApplication } from '@nestjs/common';
import type { AgentDetail, NamedItem, SaveSkillInput, SkillDetail } from '@skillflow/shared';
import { hasDatabase } from './db-env';
import {
  createTestApp,
  createWorkspace,
  lastTokenSentTo,
  signUp,
  verifyEmail,
  type TestUser,
} from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

describeDb('agents, capabilities and skills', () => {
  let app: INestApplication;
  let owner: TestUser;
  let base: string;
  let roles: NamedItem[];
  let channels: NamedItem[];
  let agent: AgentDetail;

  /** A complete skill: passes all six readiness checks. */
  function complete(skill: SkillDetail, overrides: Partial<SaveSkillInput> = {}): SaveSkillInput {
    return {
      capabilityId: skill.capabilityId,
      name: skill.name,
      startedByRoleId: null,
      trigger: 'Start of each month',
      steps: [
        { roleId: null, text: 'Drafts each plan from the template', isApproval: false, ifNo: '' },
        { roleId: roles[0].id, text: 'Approves the plans', isApproval: true, ifNo: 'Sends it back with changes' },
      ],
      inputs: [{ label: 'KPI template', need: 'automatic' }],
      channels: [{ channelId: channels[0].id, usage: 'Sends the drafts for approval' }],
      deliverable: 'Approved plans for everyone',
      humanControl: 'The line manager approves every plan',
      runsAlongside: false,
      expectedVersion: skill.version,
      ...overrides,
    };
  }

  async function newSkill(name: string): Promise<SkillDetail> {
    const res = await owner.agent
      .post(`${base}/skills`)
      .send({ capabilityId: agent.capabilities[0].id, name })
      .expect(201);
    return res.body as SkillDetail;
  }

  beforeAll(async () => {
    app = await createTestApp();
    owner = await signUp(app, 'skill-owner');
    const ws = await createWorkspace(owner, 'Skill Co');
    base = `/api/w/${ws.id}`;
    roles = (await owner.agent.get(`${base}/roles`).expect(200)).body;
    channels = (await owner.agent.get(`${base}/channels`).expect(200)).body;
    agent = (
      await owner.agent
        .post(`${base}/agents`)
        .send({ shortName: 'pla', fullName: 'People Lifecycle Agent', color: 'indigo' })
        .expect(201)
    ).body;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('gives a new workspace its starting roles and channels', () => {
    expect(roles.map((r) => r.name)).toContain('Line manager');
    expect(channels.map((c) => c.name)).toContain('Email');
  });

  it('creates an agent with an upper-case badge and a first capability', () => {
    expect(agent.shortName).toBe('PLA');
    expect(agent.capabilities.map((c) => c.name)).toEqual(['General']);
  });

  it('saves a whole skill, keeps step ids, and records each version', async () => {
    const created = await newSkill('Monthly KPI planning');
    expect(created).toMatchObject({ version: 1, status: 'draft', steps: [] });

    const first = (await owner.agent.put(`${base}/skills/${created.id}`).send(complete(created)).expect(200))
      .body as SkillDetail;
    expect(first.version).toBe(2);
    expect(first.steps).toHaveLength(2);
    expect(first.steps[1]).toMatchObject({ roleId: roles[0].id, isApproval: true });

    // Reorder and edit: existing steps keep their ids, the new one gets an id.
    const [a, b] = first.steps;
    const second = (
      await owner.agent
        .put(`${base}/skills/${created.id}`)
        .send(
          complete(first, {
            steps: [
              { ...b },
              { ...a, text: 'Drafts each plan from last month' },
              { roleId: null, text: 'Saves the approved plans', isApproval: false, ifNo: '' },
            ],
          }),
        )
        .expect(200)
    ).body as SkillDetail;
    expect(second.version).toBe(3);
    expect(second.steps.map((s) => s.id).slice(0, 2)).toEqual([b.id, a.id]);
    expect(second.steps[2].id).toBeDefined();
    expect(second.updatedBy).toBe('skill-owner');

    const { PrismaService } = await import('../src/prisma/prisma.service');
    const versions = await app
      .get(PrismaService)
      .skillVersion.findMany({ where: { skillId: created.id }, orderBy: { number: 'asc' } });
    expect(versions.map((v) => v.number)).toEqual([1, 2, 3]);
    expect(versions[0].note).toBe('Created');
    expect(versions[2].note).toBe('Changed steps (1 added, 1 edited)');
  });

  it('refuses a save made from an outdated copy', async () => {
    const skill = await newSkill('Conflict test');
    await owner.agent.put(`${base}/skills/${skill.id}`).send(complete(skill)).expect(200);
    // Same expectedVersion again: someone else saved in between.
    const conflict = await owner.agent.put(`${base}/skills/${skill.id}`).send(complete(skill)).expect(409);
    expect(conflict.body.message).toMatch(/Someone else saved/);
  });

  it('allows Defined only when the checklist is complete, and later stages only after sign-off', async () => {
    const skill = await newSkill('Status test');
    await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(400);

    const saved = (await owner.agent.put(`${base}/skills/${skill.id}`).send(complete(skill)).expect(200))
      .body as SkillDetail;
    const defined = await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(200);
    expect(defined.body.status).toBe('defined');

    const live = await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'live' }).expect(400);
    expect(live.body.message).toMatch(/sign off/);

    // Breaking the checklist sends a Defined skill back to Draft.
    const broken = (
      await owner.agent
        .put(`${base}/skills/${skill.id}`)
        .send(complete({ ...saved, version: saved.version }, { deliverable: '' }))
        .expect(200)
    ).body as SkillDetail;
    expect(broken.status).toBe('draft');
  });

  it('refuses an approval done by the agent when moving to Defined', async () => {
    const skill = await newSkill('Agent approves');
    const body = complete(skill, {
      steps: [
        { roleId: null, text: 'Drafts', isApproval: false, ifNo: '' },
        { roleId: null, text: 'Approves itself', isApproval: true, ifNo: '' },
      ],
    });
    await owner.agent.put(`${base}/skills/${skill.id}`).send(body).expect(200);
    const res = await owner.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(400);
    expect(res.body.message).toMatch(/readiness/);
  });

  it('refuses step ids from another skill', async () => {
    const one = await newSkill('One');
    const saved = (await owner.agent.put(`${base}/skills/${one.id}`).send(complete(one)).expect(200))
      .body as SkillDetail;
    const two = await newSkill('Two');
    await owner.agent
      .put(`${base}/skills/${two.id}`)
      .send(complete(two, { steps: [{ ...saved.steps[0] }] }))
      .expect(400);
  });

  it('counts skills on the agent and protects roles in use', async () => {
    const detail = (await owner.agent.get(`${base}/agents/${agent.id}`).expect(200)).body as AgentDetail;
    const skills = detail.capabilities[0].skills;
    expect(skills.length).toBeGreaterThanOrEqual(4);
    expect(skills.find((s) => s.name === 'Monthly KPI planning')?.checksPassed).toBe(6);

    const del = await owner.agent.delete(`${base}/roles/${roles[0].id}`).expect(409);
    expect(del.body.message).toMatch(/used in/);
    const fresh = (await owner.agent.post(`${base}/roles`).send({ name: 'Auditor' }).expect(201)).body as NamedItem;
    await owner.agent.post(`${base}/roles`).send({ name: 'Auditor' }).expect(409);
    await owner.agent.delete(`${base}/roles/${fresh.id}`).expect(204);
  });

  it('reorders capabilities and refuses to remove the last one', async () => {
    const withTwo = (
      await owner.agent.post(`${base}/agents/${agent.id}/capabilities`).send({ name: 'Performance pay' }).expect(201)
    ).body as AgentDetail;
    const ids = withTwo.capabilities.map((c) => c.id);
    const reordered = (
      await owner.agent
        .put(`${base}/agents/${agent.id}/capabilities/order`)
        .send({ ids: [...ids].reverse() })
        .expect(200)
    ).body as AgentDetail;
    expect(reordered.capabilities.map((c) => c.name)).toEqual(['Performance pay', 'General']);

    await owner.agent.delete(`${base}/capabilities/${ids[1]}`).expect(200);
    await owner.agent.delete(`${base}/capabilities/${ids[0]}`).expect(400);
  });

  it('lists versions, shows one, and restores an old one as a new version', async () => {
    const skill = await newSkill('History test');
    const v2 = (await owner.agent.put(`${base}/skills/${skill.id}`).send(complete(skill)).expect(200))
      .body as SkillDetail;
    const v3 = (
      await owner.agent
        .put(`${base}/skills/${skill.id}`)
        .send(complete(v2, { steps: [{ ...v2.steps[0], text: 'Drafts everything again' }], deliverable: 'Changed' }))
        .expect(200)
    ).body as SkillDetail;
    expect(v3.steps).toHaveLength(1);

    const list = (await owner.agent.get(`${base}/skills/${skill.id}/versions`).expect(200)).body;
    expect(list.map((v: { number: number }) => v.number)).toEqual([3, 2, 1]);
    expect(list[0].author).toBe('skill-owner');

    const old = (await owner.agent.get(`${base}/skills/${skill.id}/versions/2`).expect(200)).body;
    expect(old.skill.steps).toHaveLength(2);
    await owner.agent.get(`${base}/skills/${skill.id}/versions/99`).expect(404);

    // Restoring version 2 makes version 4; history only grows.
    const restored = (
      await owner.agent.post(`${base}/skills/${skill.id}/restore`).send({ number: 2, expectedVersion: 3 }).expect(200)
    ).body as SkillDetail;
    expect(restored.version).toBe(4);
    expect(restored.steps.map((s) => s.text)).toEqual(v2.steps.map((s) => s.text));
    expect(restored.deliverable).toBe(v2.deliverable);
    // The step that survived keeps its id; the deleted one comes back as new.
    expect(restored.steps[0].id).toBe(v2.steps[0].id);
    expect(restored.steps[1].id).not.toBe(v2.steps[1].id);

    const after = (await owner.agent.get(`${base}/skills/${skill.id}/versions`).expect(200)).body;
    expect(after[0]).toMatchObject({ number: 4, note: 'Restored version 2' });

    // A restore based on an outdated version is refused like any save.
    await owner.agent.post(`${base}/skills/${skill.id}/restore`).send({ number: 1, expectedVersion: 3 }).expect(409);
  });

  it('returns a capability flow with every skill and its steps in order', async () => {
    const flow = (await owner.agent.get(`${base}/capabilities/${agent.capabilities[0].id}/flow`).expect(200)).body;
    expect(flow.capabilityName).toBe('General');
    const kpi = flow.skills.find((s: { name: string }) => s.name === 'Monthly KPI planning');
    expect(kpi.steps.map((s: { text: string }) => s.text)).toEqual([
      'Approves the plans',
      'Drafts each plan from last month',
      'Saves the approved plans',
    ]);
  });

  it('lets reviewers read but not edit', async () => {
    await verifyEmail(app, owner);
    const reviewerEmail = `reviewer-${Date.now()}@example.test`;
    await owner.agent
      .post(`${base}/invites`)
      .send({ email: reviewerEmail, level: 'reviewer' })
      .expect(201);
    const reviewer = await signUp(app, 'skill-reviewer', {
      email: reviewerEmail,
      inviteToken: lastTokenSentTo(app, reviewerEmail),
    });
    await reviewer.agent.get(`${base}/agents/${agent.id}`).expect(200);
    await reviewer.agent.post(`${base}/agents`).send({ shortName: 'X', fullName: 'Nope', color: 'teal' }).expect(403);
    await reviewer.agent
      .post(`${base}/skills`)
      .send({ capabilityId: agent.capabilities[0].id, name: 'Nope' })
      .expect(403);
    await reviewer.agent.post(`${base}/roles`).send({ name: 'Nope' }).expect(403);
    const someSkill = (await reviewer.agent.get(`${base}/agents/${agent.id}`).expect(200)).body.capabilities[0].skills[0];
    await reviewer.agent.get(`${base}/skills/${someSkill.id}/versions`).expect(200);
    await reviewer.agent.post(`${base}/skills/${someSkill.id}/restore`).send({ number: 1, expectedVersion: 1 }).expect(403);
  });
});
