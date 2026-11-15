import { z } from 'zod';
import { skillStatusSchema, type SkillStatus } from './agents';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

export const INPUT_NEEDS = ['automatic', 'required'] as const;
export type InputNeed = (typeof INPUT_NEEDS)[number];

export const skillStepSchema = z.object({
  /** Present for a step that already exists, so it keeps its id (and its comments). */
  id: uuid.optional(),
  /** Empty means the agent does this step. */
  roleId: uuid.nullable(),
  text: z.string().trim().min(1, 'Describe what happens in this step').max(500),
  isApproval: z.boolean(),
  ifNo: text(300).default(''),
});
export type SkillStepInput = z.infer<typeof skillStepSchema>;

export const skillInputItemSchema = z.object({
  id: uuid.optional(),
  label: z.string().trim().min(1, 'Name the information').max(200),
  need: z.enum(INPUT_NEEDS),
});
export type SkillInputItem = z.infer<typeof skillInputItemSchema>;

export const skillChannelSchema = z.object({
  channelId: uuid,
  usage: text(200).default(''),
});
export type SkillChannelInput = z.infer<typeof skillChannelSchema>;

/** Everything a person edits in the skill editor. */
export const skillContentSchema = z.object({
  name: z.string().trim().min(1, 'Name the skill').max(120),
  /** Empty means the agent starts the skill by itself. */
  startedByRoleId: uuid.nullable(),
  trigger: text(300),
  steps: z.array(skillStepSchema).max(60, 'A skill can have at most 60 steps'),
  inputs: z.array(skillInputItemSchema).max(30),
  channels: z
    .array(skillChannelSchema)
    .max(20)
    .refine((list) => new Set(list.map((c) => c.channelId)).size === list.length, 'Each channel once'),
  deliverable: text(500),
  humanControl: text(500),
  runsAlongside: z.boolean(),
});
export type SkillContent = z.infer<typeof skillContentSchema>;

export const createSkillSchema = z.object({
  capabilityId: uuid,
  name: z.string().trim().min(1, 'Name the skill').max(120),
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const saveSkillSchema = skillContentSchema.extend({
  /** The capability the skill belongs to; changing it moves the skill. */
  capabilityId: uuid,
  /** The version the editor loaded. A save based on an older one is refused. */
  expectedVersion: z.number().int().positive(),
});
export type SaveSkillInput = z.infer<typeof saveSkillSchema>;

export const changeStatusSchema = z.object({ status: skillStatusSchema });
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const skillDetailSchema = skillContentSchema.extend({
  id: uuid,
  capabilityId: uuid,
  capabilityName: z.string(),
  agentId: uuid,
  status: skillStatusSchema,
  version: z.number().int(),
  steps: z.array(skillStepSchema.extend({ id: uuid })),
  inputs: z.array(skillInputItemSchema.extend({ id: uuid })),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});
export type SkillDetail = z.infer<typeof skillDetailSchema>;

// ------------------------------------------------------------- readiness

/** What the readiness checks look at. A loose shape, so half-typed editor state works too. */
export interface ReadinessSubject {
  trigger: string;
  steps: Array<{ roleId: string | null; isApproval: boolean; text: string }>;
  inputs: Array<unknown>;
  deliverable: string;
  humanControl: string;
}

export interface ReadinessCheck {
  key: 'trigger' | 'steps' | 'approvals' | 'inputs' | 'deliverable' | 'humanControl';
  label: string;
  ok: boolean;
  /** What to do when the check fails. */
  fix: string;
}

export const READINESS_TOTAL = 6;

/**
 * The six things a skill needs before it can be Defined (PRD 6.5).
 * Used by the editor's checklist and by the API, so they always agree.
 */
export function skillReadiness(skill: ReadinessSubject): ReadinessCheck[] {
  const approvals = skill.steps.filter((step) => step.isApproval);
  return [
    {
      key: 'trigger',
      label: 'What starts it',
      ok: skill.trigger.trim().length > 0,
      fix: 'Say what starts this skill.',
    },
    {
      key: 'steps',
      label: 'Its steps',
      ok: skill.steps.filter((step) => step.text.trim().length > 0).length >= 2,
      fix: 'Add at least two steps.',
    },
    {
      key: 'approvals',
      label: 'A person at every approval',
      ok: approvals.every((step) => step.roleId !== null),
      fix: 'Every approval step must be done by a person, not the agent.',
    },
    {
      key: 'inputs',
      label: 'The information it needs',
      ok: skill.inputs.length > 0,
      fix: 'List at least one piece of information the skill needs.',
    },
    {
      key: 'deliverable',
      label: 'What it delivers',
      ok: skill.deliverable.trim().length > 0,
      fix: 'Say what exists when the skill is done.',
    },
    {
      key: 'humanControl',
      label: 'Human control',
      ok: skill.humanControl.trim().length > 0,
      fix: 'Say what must always stay with a person.',
    },
  ];
}

export function isReady(skill: ReadinessSubject): boolean {
  return skillReadiness(skill).every((check) => check.ok);
}

export const STATUS_LABEL: Record<SkillStatus, string> = {
  draft: 'Draft',
  defined: 'Defined',
  in_build: 'In build',
  live: 'Live',
};

/**
 * Whether a skill may move to a status, and why not.
 * Draft: always. Defined: all readiness checks pass.
 * In build and Live: an approved sign-off on the current version (arrives with sign-off).
 */
export function statusChange(
  to: SkillStatus,
  context: { ready: boolean; signedOff: boolean },
): { allowed: true } | { allowed: false; reason: string } {
  if (to === 'draft') return { allowed: true };
  if (to === 'defined') {
    return context.ready
      ? { allowed: true }
      : { allowed: false, reason: 'Finish the readiness checklist first.' };
  }
  return context.signedOff
    ? { allowed: true }
    : { allowed: false, reason: 'Needs a business owner to sign off this version first.' };
}

// ------------------------------------------------------------- history

export const skillVersionSummarySchema = z.object({
  number: z.number().int(),
  note: z.string(),
  author: z.string().nullable(),
  createdAt: z.string(),
});
export type SkillVersionSummary = z.infer<typeof skillVersionSummarySchema>;

/** One saved version: the skill exactly as it was after that save. */
export const skillVersionSchema = skillVersionSummarySchema.extend({ skill: skillDetailSchema });
export type SkillVersion = z.infer<typeof skillVersionSchema>;

export const restoreSkillSchema = z.object({
  /** The version to bring back. */
  number: z.number().int().positive(),
  /** The version the editor has now, as for a normal save. */
  expectedVersion: z.number().int().positive(),
});
export type RestoreSkillInput = z.infer<typeof restoreSkillSchema>;

// ------------------------------------------------------------- full flow

export const flowSkillSchema = z.object({
  id: uuid,
  name: z.string(),
  status: skillStatusSchema,
  startedByRoleId: uuid.nullable(),
  trigger: z.string(),
  runsAlongside: z.boolean(),
  steps: z.array(z.object({ id: uuid, roleId: uuid.nullable(), text: z.string(), isApproval: z.boolean() })),
});

/** Every skill of one capability with its steps, for drawing the full flow in one request. */
export const capabilityFlowSchema = z.object({
  capabilityId: uuid,
  capabilityName: z.string(),
  skills: z.array(flowSkillSchema),
});
export type CapabilityFlow = z.infer<typeof capabilityFlowSchema>;

// ------------------------------------------------------------- what changed

export interface StepChanges {
  /** Step ids that are new compared with the earlier version. */
  added: Set<string>;
  /** Step ids whose actor, text or approval changed. */
  changed: Set<string>;
  /** Steps that were in the earlier version and are gone, with their text. */
  removed: Array<{ id: string; text: string }>;
}

/** Compares the steps of two versions of the same skill, by step id. */
export function compareSteps(
  before: Array<{ id: string; roleId: string | null; text: string; isApproval: boolean; ifNo: string }>,
  after: Array<{ id: string; roleId: string | null; text: string; isApproval: boolean; ifNo: string }>,
): StepChanges {
  const old = new Map(before.map((s) => [s.id, s]));
  const added = new Set<string>();
  const changed = new Set<string>();
  for (const step of after) {
    const prior = old.get(step.id);
    if (!prior) added.add(step.id);
    else if (
      prior.roleId !== step.roleId ||
      prior.text !== step.text ||
      prior.isApproval !== step.isApproval ||
      prior.ifNo !== step.ifNo
    ) {
      changed.add(step.id);
    }
  }
  const kept = new Set(after.map((s) => s.id));
  const removed = before.filter((s) => !kept.has(s.id)).map((s) => ({ id: s.id, text: s.text }));
  return { added, changed, removed };
}
