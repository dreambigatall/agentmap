import { saveRequestSchema, type Frequency, type RequestDetail, type SaveRequestInput } from '@skillflow/shared';
import { newKey } from '@/features/skills/editor-state';

/** Select value for "someone not in the roles list"; the name is typed instead. */
export const OTHER_ROLE = '__other';

export interface DraftStep {
  key: string;
  id?: string;
  /** A role id, OTHER_ROLE, or '' when nobody is chosen yet. */
  actor: string;
  otherRole: string;
  action: string;
  place: string;
  isApproval: boolean;
  ifNo: string;
}

export interface DraftInput {
  key: string;
  id?: string;
  what: string;
  who: string;
}

export interface RequestDraft {
  name: string;
  trigger: string;
  ownerRole: string;
  frequency: Frequency | null;
  result: string;
  steps: DraftStep[];
  inputs: DraftInput[];
  rules: string;
  problems: string;
  keepHuman: string;
}

export function toRequestDraft(r: RequestDetail): RequestDraft {
  return {
    name: r.name,
    trigger: r.trigger,
    ownerRole: r.ownerRole,
    frequency: r.frequency,
    result: r.result,
    steps: r.steps.map((s) => ({
      key: s.id,
      id: s.id,
      actor: s.roleId ?? (s.otherRole ? OTHER_ROLE : ''),
      otherRole: s.otherRole,
      action: s.action,
      place: s.place,
      isApproval: s.isApproval,
      ifNo: s.ifNo,
    })),
    inputs: r.inputs.map((i) => ({ key: i.id, id: i.id, what: i.what, who: i.who })),
    rules: r.rules,
    problems: r.problems,
    keepHuman: r.keepHuman,
  };
}

export function newRequestStep(previous?: DraftStep): DraftStep {
  return {
    key: newKey(),
    actor: previous?.actor ?? '',
    otherRole: previous?.actor === OTHER_ROLE ? previous.otherRole : '',
    action: '',
    place: '',
    isApproval: false,
    ifNo: '',
  };
}

export function newRequestInput(): DraftInput {
  return { key: newKey(), what: '', who: '' };
}

export function toRequestBody(d: RequestDraft, expectedVersion: number): SaveRequestInput {
  return {
    name: d.name,
    trigger: d.trigger,
    ownerRole: d.ownerRole,
    frequency: d.frequency,
    result: d.result,
    steps: d.steps.map((s) => ({
      id: s.id,
      roleId: s.actor && s.actor !== OTHER_ROLE ? s.actor : null,
      otherRole: s.actor === OTHER_ROLE ? s.otherRole : '',
      action: s.action,
      place: s.place,
      isApproval: s.isApproval,
      ifNo: s.isApproval ? s.ifNo : '',
    })),
    inputs: d.inputs.map((i) => ({ id: i.id, what: i.what, who: i.who })),
    rules: d.rules,
    problems: d.problems,
    keepHuman: d.keepHuman,
    expectedVersion,
  };
}

export function isRequestDirty(draft: RequestDraft, saved: RequestDetail): boolean {
  return JSON.stringify(toRequestBody(draft, 0)) !== JSON.stringify(toRequestBody(toRequestDraft(saved), 0));
}

export function validateRequest(draft: RequestDraft, version: number) {
  const result = saveRequestSchema.safeParse(toRequestBody(draft, version));
  if (result.success) return { body: result.data, errors: {} as Record<string, string> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
  return { body: null, errors };
}
