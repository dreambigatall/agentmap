import { z } from 'zod';
import { emailSchema, levelSchema } from './auth';

export const workspaceNameSchema = z.string().trim().min(2, 'Use at least 2 characters').max(60);

export const createWorkspaceSchema = z.object({ name: workspaceNameSchema });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const renameWorkspaceSchema = z.object({ name: workspaceNameSchema });
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
});
export type WorkspaceDetail = z.infer<typeof workspaceSchema>;

/** Levels that can be given through an invite or a level change. Owner moves only by transfer. */
export const ASSIGNABLE_LEVELS = ['reviewer', 'editor', 'admin'] as const;
export const assignableLevelSchema = z.enum(ASSIGNABLE_LEVELS);

export const memberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  level: levelSchema,
  addedAt: z.string(),
  lastSeenAt: z.string().nullable(),
});
export type Member = z.infer<typeof memberSchema>;

export const changeLevelSchema = z.object({ level: assignableLevelSchema });
export type ChangeLevelInput = z.infer<typeof changeLevelSchema>;

export const createInviteSchema = z.object({ email: emailSchema, level: assignableLevelSchema });
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const inviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  level: levelSchema,
  invitedBy: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type Invite = z.infer<typeof inviteSchema>;

/** What someone holding an invite link may see before signing in. */
export const inviteLookupSchema = z.object({
  workspaceName: z.string(),
  email: z.string(),
  level: levelSchema,
  invitedBy: z.string(),
  hasAccount: z.boolean(),
});
export type InviteLookup = z.infer<typeof inviteLookupSchema>;

export const acceptInviteResultSchema = z.object({ workspaceSlug: z.string() });

/** Turns a workspace name into the readable part of its address. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'workspace';
}
