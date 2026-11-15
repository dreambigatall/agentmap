import { z } from 'zod';

const uuid = z.string().uuid();
const person = z.object({ id: uuid, name: z.string() });

// ------------------------------------------------------------- comments

export const COMMENT_TARGETS = ['skill', 'request'] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

export const listCommentsQuerySchema = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: uuid,
});
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

export const createCommentSchema = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: uuid,
  /** Present for a comment on one step. */
  stepId: uuid.nullable().default(null),
  body: z.string().trim().min(1, 'Write a comment').max(4000),
  /** Members to notify. Each must belong to the workspace. */
  mentions: z.array(uuid).max(20).default([]),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const editCommentSchema = z.object({ body: z.string().trim().min(1, 'Write a comment').max(4000) });
export type EditCommentInput = z.infer<typeof editCommentSchema>;

export const commentSchema = z.object({
  id: uuid,
  targetType: z.enum(COMMENT_TARGETS),
  targetId: uuid,
  stepId: uuid.nullable(),
  body: z.string(),
  author: person,
  mentions: z.array(person),
  resolved: z.boolean(),
  resolvedBy: z.string().nullable(),
  editedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;

// ------------------------------------------------------------- sign-off

export const SIGNOFF_STATUSES = ['pending', 'approved', 'changes_asked', 'cancelled', 'outdated'] as const;
export type SignoffStatus = (typeof SIGNOFF_STATUSES)[number];

export const SIGNOFF_STATUS_LABEL: Record<SignoffStatus, string> = {
  pending: 'Waiting for sign-off',
  approved: 'Signed off',
  changes_asked: 'Changes asked',
  cancelled: 'Cancelled',
  outdated: 'Outdated',
};

export const requestSignoffSchema = z.object({ ownerId: uuid });
export type RequestSignoffInput = z.infer<typeof requestSignoffSchema>;

export const decideSignoffSchema = z
  .object({
    decision: z.enum(['approve', 'changes']),
    note: z.string().trim().max(1000).default(''),
  })
  .refine((d) => d.decision === 'approve' || d.note.length > 0, {
    message: 'Say what needs to change',
    path: ['note'],
  });
export type DecideSignoffInput = z.infer<typeof decideSignoffSchema>;

export const signoffSchema = z.object({
  id: uuid,
  skillId: uuid,
  skillVersion: z.number().int(),
  status: z.enum(SIGNOFF_STATUSES),
  requestedBy: person,
  owner: person,
  note: z.string(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Signoff = z.infer<typeof signoffSchema>;

/** True when a business owner approved exactly this version. */
export function isSignedOff(signoffs: Array<Pick<Signoff, 'status' | 'skillVersion'>>, version: number): boolean {
  return signoffs.some((s) => s.status === 'approved' && s.skillVersion === version);
}

/** The sign-off that describes the skill now: an open request, or the latest decision. */
export function currentSignoff<T extends Pick<Signoff, 'status' | 'createdAt'>>(signoffs: T[]): T | null {
  const open = signoffs.find((s) => s.status === 'pending');
  if (open) return open;
  return [...signoffs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

// ------------------------------------------------------------- notifications

export const NOTIFICATION_KINDS = [
  'request_submitted',
  'request_decided',
  'request_converted',
  'comment_mention',
  'comment_reply',
  'signoff_requested',
  'signoff_decided',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notificationSchema = z.object({
  id: uuid,
  kind: z.string(),
  text: z.string(),
  link: z.string(),
  actor: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unread: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

/** No ids means "mark everything read". */
export const markReadSchema = z.object({ ids: z.array(uuid).max(100).optional() });
export type MarkReadInput = z.infer<typeof markReadSchema>;
