import { z } from 'zod';
import { AGENT_COLORS, skillStatusSchema } from './agents';
import { INPUT_NEEDS, skillDetailSchema } from './skills';
import { REQUEST_STATUSES } from './requests';

const uuid = z.string().uuid();

// ------------------------------------------------------------- share links

/** A share token: 32 random bytes in base64url. Anything else is refused before a lookup. */
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Not a share link');

export const shareLinkSchema = z.object({
  id: uuid,
  token: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  lastViewedAt: z.string().nullable(),
});
export type ShareLink = z.infer<typeof shareLinkSchema>;

/**
 * What a public share page shows: the agent with its skills and the roles and channels
 * they name. Never comments, history, requests, sign-offs or who changed what.
 */
export const publicAgentSchema = z.object({
  workspaceName: z.string(),
  agent: z.object({
    id: uuid,
    shortName: z.string(),
    fullName: z.string(),
    description: z.string(),
    color: z.enum(AGENT_COLORS),
  }),
  roles: z.array(z.object({ id: uuid, name: z.string() })),
  channels: z.array(z.object({ id: uuid, name: z.string() })),
  capabilities: z.array(
    z.object({
      id: uuid,
      name: z.string(),
      skills: z.array(skillDetailSchema),
    }),
  ),
});
export type PublicAgent = z.infer<typeof publicAgentSchema>;

// ------------------------------------------------------------- export

export const SKILL_EXPORT_FORMAT = 'skillflow.skill/v1';

/** A skill as a portable file. Roles and channels are names, so it reads on its own. */
export const skillExportSchema = z.object({
  format: z.literal(SKILL_EXPORT_FORMAT),
  exportedAt: z.string(),
  skill: z.object({
    name: z.string(),
    agent: z.string(),
    capability: z.string(),
    status: skillStatusSchema,
    version: z.number().int(),
    startedBy: z.string(),
    trigger: z.string(),
    steps: z.array(
      z.object({ doneBy: z.string(), text: z.string(), isApproval: z.boolean(), ifNo: z.string() }),
    ),
    inputs: z.array(z.object({ label: z.string(), need: z.enum(INPUT_NEEDS) })),
    channels: z.array(z.object({ name: z.string(), usage: z.string() })),
    deliverable: z.string(),
    humanControl: z.string(),
    runsAlongside: z.boolean(),
  }),
});
export type SkillExport = z.infer<typeof skillExportSchema>;

/** A safe file name for a download, from any skill name. */
export function exportFileName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'skill'}.skillflow.json`;
}

// ------------------------------------------------------------- dashboard

export const dashboardQuerySchema = z.object({ agentId: uuid.optional() });
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

const dashboardRequest = z.object({
  id: uuid,
  name: z.string(),
  agentId: uuid,
  status: z.enum(REQUEST_STATUSES),
  author: z.string(),
  updatedAt: z.string(),
});

export const dashboardSchema = z.object({
  counts: z.object({
    draft: z.number().int(),
    defined: z.number().int(),
    in_build: z.number().int(),
    live: z.number().int(),
  }),
  /** Sign-offs asked of the viewer that they have not decided yet. */
  waitingOnMe: z.array(
    z.object({
      id: uuid,
      skillId: uuid,
      skillName: z.string(),
      agentId: uuid,
      askedBy: z.string(),
      askedAt: z.string(),
    }),
  ),
  /** New and in-review requests, for editors who turn them into skills. Empty for others. */
  toReview: z.array(dashboardRequest),
  /** The viewer's own requests that are not decided yet. */
  myRequests: z.array(dashboardRequest),
  recent: z.array(
    z.object({
      kind: z.enum(['skill', 'request']),
      id: uuid,
      agentId: uuid,
      title: z.string(),
      note: z.string(),
      author: z.string().nullable(),
      at: z.string(),
    }),
  ),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

// ------------------------------------------------------------- search

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(100),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const SEARCH_TYPES = ['agent', 'capability', 'skill', 'step', 'request'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const searchResultSchema = z.object({
  type: z.enum(SEARCH_TYPES),
  id: uuid,
  title: z.string(),
  /** Where it lives, such as "PLA · Planning". */
  context: z.string(),
  agentId: uuid,
  /** For skills and steps: the skill to open. For requests: null. */
  skillId: uuid.nullable(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResultsSchema = z.object({ results: z.array(searchResultSchema) });
export type SearchResults = z.infer<typeof searchResultsSchema>;

/** Where a search result opens in the app. */
export function searchResultPath(workspaceSlug: string, result: SearchResult): string {
  const base = `/w/${workspaceSlug}`;
  if (result.type === 'request') return `${base}/requests/${result.id}`;
  if (result.skillId) return `${base}/skills/${result.skillId}`;
  return `${base}/agents/${result.agentId}`;
}
