import { z } from 'zod';

// ------------------------------------------------------------- roles and channels

export const namedItemNameSchema = z.string().trim().min(1, 'Enter a name').max(60, 'Use at most 60 characters');

export const createNamedItemSchema = z.object({ name: namedItemNameSchema });
export type CreateNamedItemInput = z.infer<typeof createNamedItemSchema>;

/** A role (who can do a step) or a channel (where the agent talks to people). */
export const namedItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** How many skills use it. Something in use cannot be deleted. */
  usedBy: z.number().int(),
});
export type NamedItem = z.infer<typeof namedItemSchema>;

export const DEFAULT_ROLES = [
  'Line manager',
  'Team lead',
  'Department manager',
  'People team',
  'Finance',
  'Customer',
] as const;

export const DEFAULT_CHANNELS = ['Email', 'Slack', 'Microsoft Teams', 'In-app'] as const;

// ------------------------------------------------------------- agents

/** Badge colours. Names map to design tokens in the web app, never to raw colours here. */
export const AGENT_COLORS = ['indigo', 'teal', 'fuchsia', 'amber', 'emerald', 'rose', 'sky', 'violet'] as const;
export type AgentColor = (typeof AGENT_COLORS)[number];

export const agentInputSchema = z.object({
  shortName: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a short name')
    .max(6, 'Use at most 6 characters')
    .regex(/^[A-Z0-9]+$/, 'Use letters and numbers only'),
  fullName: z.string().trim().min(2, 'Use at least 2 characters').max(80),
  description: z.string().trim().max(500).default(''),
  color: z.enum(AGENT_COLORS),
});
export type AgentInput = z.infer<typeof agentInputSchema>;

export const updateAgentSchema = agentInputSchema.partial();
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export const capabilityInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80),
});
export type CapabilityInput = z.infer<typeof capabilityInputSchema>;

export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
export type ReorderInput = z.infer<typeof reorderSchema>;

export const SKILL_STATUSES = ['draft', 'defined', 'in_build', 'live'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];
export const skillStatusSchema = z.enum(SKILL_STATUSES);

export const skillSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: skillStatusSchema,
  runsAlongside: z.boolean(),
  stepCount: z.number().int(),
  /** Readiness checks passed, out of READINESS_TOTAL. */
  checksPassed: z.number().int(),
  updatedAt: z.string(),
});
export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const capabilitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  skills: z.array(skillSummarySchema),
});
export type Capability = z.infer<typeof capabilitySchema>;

const agentBase = {
  id: z.string().uuid(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string(),
  color: z.enum(AGENT_COLORS),
};

/** For the sidebar: each agent with its skill count. */
export const agentSummarySchema = z.object({ ...agentBase, skillCount: z.number().int() });
export type AgentSummary = z.infer<typeof agentSummarySchema>;

/** For the agent page: capabilities in order, each with its skills in order. */
export const agentDetailSchema = z.object({ ...agentBase, capabilities: z.array(capabilitySchema) });
export type AgentDetail = z.infer<typeof agentDetailSchema>;
