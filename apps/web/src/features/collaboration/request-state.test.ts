import type { RequestDetail } from '@skillflow/shared';
import { describe, expect, it } from 'vitest';
import {
  isRequestDirty,
  newRequestStep,
  OTHER_ROLE,
  toRequestBody,
  toRequestDraft,
  validateRequest,
} from './request-state';

const ROLE = '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f';
const saved: RequestDetail = {
  id: '1b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f',
  agentId: '2b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f',
  name: 'Pre-contract analysis',
  status: 'new',
  version: 2,
  trigger: '',
  ownerRole: '',
  frequency: null,
  result: '',
  rules: '',
  problems: '',
  keepHuman: '',
  author: { id: '3b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f', name: 'Sam' },
  skillId: null,
  skillName: null,
  steps: [
    { id: '4b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f', roleId: null, otherRole: 'Sourcing officer', action: 'Checks the PI', place: '', isApproval: false, ifNo: '' },
    { id: '5b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f', roleId: ROLE, otherRole: '', action: 'Approves', place: '', isApproval: true, ifNo: 'Sends it back' },
  ],
  inputs: [],
  files: [],
  createdAt: '2026-11-15T00:00:00.000Z',
  updatedAt: '2026-11-15T00:00:00.000Z',
};

describe('request form state', () => {
  it('round-trips without changes, keeping free-text actors', () => {
    const draft = toRequestDraft(saved);
    expect(draft.steps[0].actor).toBe(OTHER_ROLE);
    expect(isRequestDirty(draft, saved)).toBe(false);
    expect(toRequestBody(draft, 2).steps[0]).toMatchObject({ roleId: null, otherRole: 'Sourcing officer' });
  });

  it('starts a new step with the same person as the one before', () => {
    const draft = toRequestDraft(saved);
    expect(newRequestStep(draft.steps[0])).toMatchObject({ actor: OTHER_ROLE, otherRole: 'Sourcing officer' });
  });

  it('points at the step that has nobody doing it', () => {
    const draft = toRequestDraft(saved);
    draft.steps.push({ ...newRequestStep(), action: 'Floats' });
    const { body, errors } = validateRequest(draft, 2);
    expect(body).toBeNull();
    expect(errors['steps.2.roleId']).toBe('Choose who does it');
  });
});
