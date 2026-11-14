/**
 * Workspace permission levels and what each may do.
 * Source: PRD section 3, "Workspace permission levels".
 * The backend guards and the frontend <Can> component both read this table,
 * so the two can never disagree.
 */

export const LEVELS = ['reviewer', 'editor', 'admin', 'owner'] as const;
export type Level = (typeof LEVELS)[number];

export const ACTIONS = [
  'billing.manage',
  'workspace.delete',
  'members.manage',
  'settings.edit',
  'content.edit',
  'requests.review',
  'shares.manage',
  'requests.submit',
  'comments.write',
  'signoffs.decide',
] as const;
export type Action = (typeof ACTIONS)[number];

/** The lowest level allowed to perform each action. */
export const MIN_LEVEL: Record<Action, Level> = {
  'billing.manage': 'owner',
  'workspace.delete': 'owner',
  'members.manage': 'admin',
  'settings.edit': 'admin',
  'content.edit': 'editor',
  'requests.review': 'editor',
  'shares.manage': 'editor',
  'requests.submit': 'reviewer',
  'comments.write': 'reviewer',
  'signoffs.decide': 'reviewer',
};

export function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

/** True when `level` is the same as or higher than `required`. */
export function atLeast(level: Level, required: Level): boolean {
  return levelRank(level) >= levelRank(required);
}

export function can(level: Level, action: Action): boolean {
  return atLeast(level, MIN_LEVEL[action]);
}
