import {
  saveSkillSchema,
  type SaveSkillInput,
  type SkillChannelInput,
  type SkillDetail,
  type SkillInputItem,
  type SkillStepInput,
} from '@skillflow/shared';

/** Each row carries a key for React, separate from its database id (new rows have none). */
export type DraftStep = SkillStepInput & { key: string };
export type DraftInput = SkillInputItem & { key: string };

export interface Draft {
  capabilityId: string;
  name: string;
  startedByRoleId: string | null;
  trigger: string;
  steps: DraftStep[];
  inputs: DraftInput[];
  channels: SkillChannelInput[];
  deliverable: string;
  humanControl: string;
  runsAlongside: boolean;
}

/** Value used in selects for "the agent", since a select cannot hold null. */
export const AGENT_ACTOR = '__agent';

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `new-${Date.now().toString(36)}-${counter}`;
}

export function toDraft(skill: SkillDetail): Draft {
  return {
    capabilityId: skill.capabilityId,
    name: skill.name,
    startedByRoleId: skill.startedByRoleId,
    trigger: skill.trigger,
    steps: skill.steps.map((s) => ({ ...s, key: s.id })),
    inputs: skill.inputs.map((i) => ({ ...i, key: i.id })),
    channels: skill.channels.map((c) => ({ ...c })),
    deliverable: skill.deliverable,
    humanControl: skill.humanControl,
    runsAlongside: skill.runsAlongside,
  };
}

export function newStep(previous?: DraftStep): DraftStep {
  // A new step usually follows on from the one before, so start with the same actor.
  return { key: newKey(), roleId: previous?.roleId ?? null, text: '', isApproval: false, ifNo: '' };
}

export function newInput(): DraftInput {
  return { key: newKey(), label: '', need: 'automatic' };
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The body for PUT /skills/:id. Row keys stay in the browser. */
export function toSaveBody(draft: Draft, expectedVersion: number): SaveSkillInput {
  return {
    capabilityId: draft.capabilityId,
    name: draft.name,
    startedByRoleId: draft.startedByRoleId,
    trigger: draft.trigger,
    steps: draft.steps.map(({ key: _key, ...step }) => step),
    inputs: draft.inputs.map(({ key: _key, ...input }) => input),
    channels: draft.channels,
    deliverable: draft.deliverable,
    humanControl: draft.humanControl,
    runsAlongside: draft.runsAlongside,
    expectedVersion,
  };
}

/** True when the draft differs from what was last saved. */
export function isDirty(draft: Draft, saved: SkillDetail): boolean {
  return JSON.stringify(toSaveBody(draft, saved.version)) !== JSON.stringify(toSaveBody(toDraft(saved), saved.version));
}

/**
 * Checks the draft with the shared schema and returns problems by field path,
 * e.g. "steps.2.text", so each message can show beside its own control.
 */
export function validateDraft(draft: Draft, version: number): { body: SaveSkillInput | null; errors: Record<string, string> } {
  const body = toSaveBody(draft, version);
  const result = saveSkillSchema.safeParse(body);
  if (result.success) return { body: result.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] ??= issue.message;
  }
  return { body: null, errors };
}
