import type { SkillDetail } from '@skillflow/shared';
import { describe, expect, it } from 'vitest';
import { isDirty, move, newStep, toDraft, toSaveBody, validateDraft } from './editor-state';

const ROLE = '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f';
const STEP = '1b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f';

const saved: SkillDetail = {
  id: '2b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f',
  capabilityId: '3b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f',
  capabilityName: 'General',
  agentId: '4b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f',
  name: 'Monthly KPI planning',
  status: 'draft',
  version: 3,
  startedByRoleId: null,
  trigger: 'Start of each month',
  steps: [{ id: STEP, roleId: ROLE, text: 'Approves', isApproval: true, ifNo: '' }],
  inputs: [],
  channels: [],
  deliverable: '',
  humanControl: '',
  runsAlongside: false,
  updatedAt: '2026-11-15T10:00:00.000Z',
  updatedBy: 'Sam',
};

describe('skill editor state', () => {
  it('round-trips a saved skill without changes', () => {
    const draft = toDraft(saved);
    expect(isDirty(draft, saved)).toBe(false);
    expect(toSaveBody(draft, saved.version).steps[0]).toEqual(saved.steps[0]);
  });

  it('notices an edit and keeps row keys out of the body', () => {
    const draft = toDraft(saved);
    draft.steps.push(newStep(draft.steps[0]));
    expect(isDirty(draft, saved)).toBe(true);
    const body = toSaveBody(draft, saved.version);
    expect(body.steps[1]).not.toHaveProperty('key');
    expect(body.steps[1].roleId).toBe(ROLE);
    expect(body.expectedVersion).toBe(3);
  });

  it('reports problems by field path', () => {
    const draft = toDraft(saved);
    draft.steps.push(newStep());
    const { body, errors } = validateDraft(draft, saved.version);
    expect(body).toBeNull();
    expect(errors['steps.1.text']).toMatch(/Describe/);
  });

  it('moves rows and ignores moves past the ends', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
