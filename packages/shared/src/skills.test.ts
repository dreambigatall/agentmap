import { describe, expect, it } from 'vitest';
import { agentInputSchema } from './agents';
import {
  compareSteps,
  isReady,
  saveSkillSchema,
  skillReadiness,
  statusChange,
  type ReadinessSubject,
} from './skills';

const complete: ReadinessSubject = {
  trigger: 'Start of each month',
  steps: [
    { roleId: null, isApproval: false, text: 'Drafts the plans' },
    { roleId: '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f', isApproval: true, text: 'Approves the plans' },
  ],
  inputs: [{ label: 'Template', need: 'automatic' }],
  deliverable: 'Approved plans',
  humanControl: 'Managers approve every plan',
};

describe('skillReadiness', () => {
  it('passes a complete skill', () => {
    expect(isReady(complete)).toBe(true);
    expect(skillReadiness(complete).every((c) => c.ok)).toBe(true);
  });

  it('needs two steps that say something', () => {
    const one = { ...complete, steps: [complete.steps[0], { ...complete.steps[1], text: '  ' }] };
    expect(skillReadiness(one).find((c) => c.key === 'steps')?.ok).toBe(false);
  });

  it('refuses an approval done by the agent', () => {
    const agentApproves = {
      ...complete,
      steps: [complete.steps[0], { ...complete.steps[1], roleId: null }],
    };
    expect(skillReadiness(agentApproves).find((c) => c.key === 'approvals')?.ok).toBe(false);
  });

  it('flags every empty field', () => {
    const empty: ReadinessSubject = { trigger: '', steps: [], inputs: [], deliverable: '', humanControl: ' ' };
    expect(skillReadiness(empty).filter((c) => !c.ok).map((c) => c.key)).toEqual([
      'trigger',
      'steps',
      'inputs',
      'deliverable',
      'humanControl',
    ]);
  });
});

describe('statusChange', () => {
  it('always allows going back to draft', () => {
    expect(statusChange('draft', { ready: false, signedOff: false }).allowed).toBe(true);
  });

  it('needs readiness for defined and sign-off beyond', () => {
    expect(statusChange('defined', { ready: false, signedOff: false }).allowed).toBe(false);
    expect(statusChange('defined', { ready: true, signedOff: false }).allowed).toBe(true);
    expect(statusChange('live', { ready: true, signedOff: false }).allowed).toBe(false);
    expect(statusChange('in_build', { ready: true, signedOff: true }).allowed).toBe(true);
  });
});

describe('schemas', () => {
  it('upper-cases the agent short name', () => {
    expect(agentInputSchema.parse({ shortName: ' pla ', fullName: 'People Agent', color: 'teal' }).shortName).toBe(
      'PLA',
    );
  });

  it('refuses the same channel twice', () => {
    const channelId = '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f';
    const result = saveSkillSchema.safeParse({
      capabilityId: channelId,
      name: 'X',
      startedByRoleId: null,
      trigger: '',
      steps: [],
      inputs: [],
      channels: [
        { channelId, usage: '' },
        { channelId, usage: '' },
      ],
      deliverable: '',
      humanControl: '',
      runsAlongside: false,
      expectedVersion: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('compareSteps', () => {
  const step = (id: string, text: string) => ({ id, roleId: null, text, isApproval: false, ifNo: '' });

  it('finds added, changed and removed steps by id', () => {
    const result = compareSteps([step('a', 'Drafts'), step('b', 'Checks'), step('c', 'Saves')], [
      step('b', 'Checks twice'),
      step('a', 'Drafts'),
      step('d', 'Sends'),
    ]);
    expect([...result.added]).toEqual(['d']);
    expect([...result.changed]).toEqual(['b']);
    expect(result.removed).toEqual([{ id: 'c', text: 'Saves' }]);
  });
});
