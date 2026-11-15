import type { INestApplication } from '@nestjs/common';
import type { AgentDetail, NamedItem, RequestDetail, Signoff, SkillDetail } from '@skillflow/shared';
import { hasDatabase } from './db-env';
import {
  createTestApp,
  createWorkspace,
  lastTokenSentTo,
  signUp,
  uniqueEmail,
  verifyEmail,
  type TestUser,
} from './helpers';

const describeDb = hasDatabase ? describe : describe.skip;

/**
 * Phase 4 end to end: a reviewer describes today's work, an editor turns it into a
 * skill, a business owner signs it off, and everyone hears about what concerns them.
 */
describeDb('requests, comments, sign-off and notifications', () => {
  let app: INestApplication;
  let editor: TestUser; // workspace owner, so editor rights and more
  let reviewer: TestUser;
  let businessOwner: TestUser;
  let base: string;
  let agent: AgentDetail;
  let roles: NamedItem[];
  let request: RequestDetail;
  let skill: SkillDetail;

  async function invite(label: string, level: 'reviewer' | 'admin'): Promise<TestUser> {
    const email = uniqueEmail(label);
    await editor.agent.post(`${base}/invites`).send({ email, level }).expect(201);
    return signUp(app, label, { email, inviteToken: lastTokenSentTo(app, email) });
  }

  async function unreadKinds(user: TestUser): Promise<string[]> {
    const res = await user.agent.get(`${base}/notifications`).expect(200);
    return res.body.items.filter((n: { read: boolean }) => !n.read).map((n: { kind: string }) => n.kind);
  }

  beforeAll(async () => {
    app = await createTestApp();
    editor = await signUp(app, 'p4-editor');
    await verifyEmail(app, editor);
    const ws = await createWorkspace(editor, 'Phase Four Co');
    base = `/api/w/${ws.id}`;
    reviewer = await invite('p4-reviewer', 'reviewer');
    businessOwner = await invite('p4-owner', 'admin');
    roles = (await editor.agent.get(`${base}/roles`).expect(200)).body;
    agent = (
      await editor.agent
        .post(`${base}/agents`)
        .send({ shortName: 'PCA', fullName: 'Project Control Agent', color: 'teal' })
        .expect(201)
    ).body;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lets a reviewer submit a request and tells the editors', async () => {
    request = (
      await reviewer.agent.post(`${base}/requests`).send({ agentId: agent.id, name: 'Pre-contract analysis' }).expect(201)
    ).body;
    expect(request).toMatchObject({ status: 'new', version: 1, author: { name: 'p4-reviewer' } });
    expect(await unreadKinds(editor)).toContain('request_submitted');
    expect(await unreadKinds(businessOwner)).toContain('request_submitted');
    expect(await unreadKinds(reviewer)).not.toContain('request_submitted');
  });

  it('saves the five-part form with a free-text actor and refuses outdated saves', async () => {
    const body = {
      name: 'Pre-contract analysis',
      trigger: 'The AE hands over an awarded deal',
      ownerRole: 'Project manager',
      frequency: 'when_needed',
      result: 'An approved concept note',
      steps: [
        { roleId: null, otherRole: 'Sourcing officer', action: 'Checks each PI', place: 'Email', isApproval: false },
        { roleId: roles[0].id, action: 'Approves the team', isApproval: true, ifNo: 'Changes the team' },
      ],
      inputs: [{ what: 'Handover pack', who: 'AE' }],
      rules: 'Within 2 working days',
      problems: 'PIs are checked by hand',
      keepHuman: 'Choosing the team',
      expectedVersion: 1,
    };
    request = (await reviewer.agent.put(`${base}/requests/${request.id}`).send(body).expect(200)).body;
    expect(request.version).toBe(2);
    expect(request.steps[0]).toMatchObject({ roleId: null, otherRole: 'Sourcing officer', place: 'Email' });
    await reviewer.agent.put(`${base}/requests/${request.id}`).send(body).expect(409);
    // A step with nobody doing it is refused by the shared rules.
    await reviewer.agent
      .put(`${base}/requests/${request.id}`)
      .send({ ...body, expectedVersion: 2, steps: [{ roleId: null, action: 'Floats', isApproval: false }] })
      .expect(400);
  });

  it('stores files in Postgres, serves them as downloads, and refuses disguised programs', async () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
    const uploaded = await reviewer.agent
      .post(`${base}/requests/${request.id}/files`)
      .field('requestInputId', request.inputs[0].id)
      .attach('file', pdf, 'handover.pdf')
      .expect(201);
    expect(uploaded.body).toMatchObject({ name: 'handover.pdf', mimeType: 'application/pdf', size: pdf.length });

    const download = await editor.agent
      .get(`${base}/files/${uploaded.body.id}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(Buffer.compare(download.body as Buffer, pdf)).toBe(0);
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);
    expect(download.headers['x-content-type-options']).toBe('nosniff');

    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const refused = await reviewer.agent
      .post(`${base}/requests/${request.id}/files`)
      .attach('file', exe, 'invoice.pdf')
      .expect(400);
    expect(refused.body.message).toMatch(/does not look like a real \.pdf/);
    await reviewer.agent.post(`${base}/requests/${request.id}/files`).attach('file', exe, 'tool.exe').expect(400);

    const detail = (await editor.agent.get(`${base}/requests/${request.id}`).expect(200)).body as RequestDetail;
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0]).not.toHaveProperty('data');
  });

  it('lets only editors decide, and locks the form once approved', async () => {
    await reviewer.agent.post(`${base}/requests/${request.id}/status`).send({ status: 'approved' }).expect(403);
    await editor.agent.post(`${base}/requests/${request.id}/status`).send({ status: 'in_review' }).expect(200);
    request = (
      await editor.agent.post(`${base}/requests/${request.id}/status`).send({ status: 'approved' }).expect(200)
    ).body;
    expect(request.status).toBe('approved');
    expect(await unreadKinds(reviewer)).toContain('request_decided');
    const locked = await reviewer.agent
      .put(`${base}/requests/${request.id}`)
      .send({ ...request, steps: request.steps, expectedVersion: request.version })
      .expect(403);
    expect(locked.body.message).toMatch(/decided/);
  });

  it('turns the approved request into a draft skill, once', async () => {
    skill = (
      await editor.agent
        .post(`${base}/requests/${request.id}/convert`)
        .send({ capabilityId: agent.capabilities[0].id })
        .expect(201)
    ).body;
    expect(skill).toMatchObject({ name: 'Pre-contract analysis', status: 'draft', version: 1 });
    expect(skill.steps.map((s) => s.text)).toEqual(['Checks each PI (Email)', 'Approves the team']);
    expect(skill.steps[1]).toMatchObject({ roleId: roles[0].id, isApproval: true, ifNo: 'Changes the team' });

    // "Sourcing officer" became a real role.
    const updatedRoles = (await editor.agent.get(`${base}/roles`).expect(200)).body as NamedItem[];
    const sourcing = updatedRoles.find((r) => r.name === 'Sourcing officer');
    expect(sourcing).toBeDefined();
    expect(skill.steps[0].roleId).toBe(sourcing!.id);

    const linked = (await editor.agent.get(`${base}/requests/${request.id}`).expect(200)).body;
    expect(linked).toMatchObject({ skillId: skill.id, skillName: 'Pre-contract analysis' });
    await editor.agent
      .post(`${base}/requests/${request.id}/convert`)
      .send({ capabilityId: agent.capabilities[0].id })
      .expect(409);
    expect(await unreadKinds(reviewer)).toContain('request_converted');
  });

  it('keeps comments on a step, notifies mentions, and limits who may change them', async () => {
    const stepId = skill.steps[0].id;
    const comment = await reviewer.agent
      .post(`${base}/comments`)
      .send({ targetType: 'skill', targetId: skill.id, stepId, body: 'Who checks the PI validity?', mentions: [businessOwner.me.id] })
      .expect(201);
    expect(comment.body).toMatchObject({
      stepId,
      resolved: false,
      mentions: [{ id: businessOwner.me.id, name: 'p4-owner' }],
    });
    expect(await unreadKinds(businessOwner)).toContain('comment_mention');

    await editor.agent.patch(`${base}/comments/${comment.body.id}`).send({ body: 'Changed' }).expect(403);
    await reviewer.agent.patch(`${base}/comments/${comment.body.id}`).send({ body: 'Who checks validity?' }).expect(200);
    const resolved = await editor.agent.post(`${base}/comments/${comment.body.id}/resolve`).expect(200);
    expect(resolved.body).toMatchObject({ resolved: true, resolvedBy: 'p4-editor' });

    // A step id from somewhere else is refused; mentioning an outsider too.
    await reviewer.agent
      .post(`${base}/comments`)
      .send({ targetType: 'skill', targetId: skill.id, stepId: request.steps[0].id, body: 'Wrong step' })
      .expect(400);
    await reviewer.agent
      .post(`${base}/comments`)
      .send({ targetType: 'skill', targetId: skill.id, body: 'Hi', mentions: ['5f0c9a52-3c1d-4f7e-9b2a-7d6e5c4b3a21'] })
      .expect(400);

    const list = await reviewer.agent.get(`${base}/comments?targetType=skill&targetId=${skill.id}`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].editedAt).not.toBeNull();
  });

  it('runs sign-off: only Defined skills, only another member, only the owner decides', async () => {
    // Make the converted skill complete and Defined.
    const complete = {
      capabilityId: skill.capabilityId,
      name: skill.name,
      startedByRoleId: null,
      trigger: skill.trigger,
      steps: skill.steps,
      inputs: [{ label: 'Handover pack', need: 'required' }],
      channels: [],
      deliverable: 'An approved concept note',
      humanControl: 'The project manager chooses the team',
      runsAlongside: false,
      expectedVersion: skill.version,
    };
    skill = (await editor.agent.put(`${base}/skills/${skill.id}`).send(complete).expect(200)).body;
    await editor.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: businessOwner.me.id }).expect(400);
    skill = (await editor.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'defined' }).expect(200)).body;

    await editor.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: editor.me.id }).expect(400);
    await reviewer.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: businessOwner.me.id }).expect(403);
    const asked = (
      await editor.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: businessOwner.me.id }).expect(201)
    ).body as Signoff;
    expect(asked).toMatchObject({ status: 'pending', skillVersion: skill.version });
    await editor.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: businessOwner.me.id }).expect(409);
    expect(await unreadKinds(businessOwner)).toContain('signoff_requested');

    // Not signed off yet: In build stays locked.
    await editor.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'in_build' }).expect(400);
    await editor.agent.post(`${base}/signoffs/${asked.id}/decide`).send({ decision: 'approve' }).expect(403);
    await businessOwner.agent.post(`${base}/signoffs/${asked.id}/decide`).send({ decision: 'changes', note: '' }).expect(400);

    const approved = await businessOwner.agent
      .post(`${base}/signoffs/${asked.id}/decide`)
      .send({ decision: 'approve', note: 'Looks right' })
      .expect(200);
    expect(approved.body.status).toBe('approved');
    expect(await unreadKinds(editor)).toContain('signoff_decided');

    const building = await editor.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'in_build' }).expect(200);
    expect(building.body.status).toBe('in_build');

    // Editing the signed-off skill: sign-off outdated, status back to Defined, In build locked again.
    const edited = (
      await editor.agent
        .put(`${base}/skills/${skill.id}`)
        .send({ ...complete, deliverable: 'An approved concept note v2', expectedVersion: building.body.version })
        .expect(200)
    ).body as SkillDetail;
    expect(edited.status).toBe('defined');
    const signoffs = (await editor.agent.get(`${base}/skills/${skill.id}/signoffs`).expect(200)).body as Signoff[];
    expect(signoffs[0].status).toBe('outdated');
    await editor.agent.post(`${base}/skills/${skill.id}/status`).send({ status: 'in_build' }).expect(400);

    // A request for the new version, then cancelled by the person who asked.
    const again = (
      await editor.agent.post(`${base}/skills/${skill.id}/signoffs`).send({ ownerId: businessOwner.me.id }).expect(201)
    ).body as Signoff;
    await reviewer.agent.post(`${base}/signoffs/${again.id}/cancel`).expect(403);
    const cancelled = await editor.agent.post(`${base}/signoffs/${again.id}/cancel`).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('marks notifications read', async () => {
    const before = await editor.agent.get(`${base}/notifications`).expect(200);
    expect(before.body.unread).toBeGreaterThan(0);
    await editor.agent.post(`${base}/notifications/read`).send({}).expect(204);
    const after = await editor.agent.get(`${base}/notifications`).expect(200);
    expect(after.body.unread).toBe(0);
    expect(after.body.items[0].link).toMatch(/^\/w\/phase-four-co/);
  });
});
