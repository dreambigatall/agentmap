import { z } from 'zod';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

export const REQUEST_STATUSES = ['new', 'in_review', 'approved', 'declined'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'New',
  in_review: 'In review',
  approved: 'Approved',
  declined: 'Declined',
};

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'when_needed'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  when_needed: 'When needed',
};

/** One step of today's process. Who does it is a workspace role, or free text. */
export const requestStepSchema = z
  .object({
    id: uuid.optional(),
    roleId: uuid.nullable(),
    otherRole: text(80).default(''),
    action: z.string().trim().min(1, 'Say what happens in this step').max(500),
    place: text(200).default(''),
    isApproval: z.boolean(),
    ifNo: text(300).default(''),
  })
  .refine((step) => step.roleId !== null || step.otherRole.length > 0, {
    message: 'Choose who does it',
    path: ['roleId'],
  });
export type RequestStepInput = z.infer<typeof requestStepSchema>;

export const requestInputSchema = z.object({
  id: uuid.optional(),
  what: z.string().trim().min(1, 'Name the information or document').max(200),
  who: text(120).default(''),
});
export type RequestInputItem = z.infer<typeof requestInputSchema>;

/** The five parts of the request form. */
export const requestContentSchema = z.object({
  name: z.string().trim().min(1, 'Name the workflow').max(120),
  trigger: text(500),
  ownerRole: text(80),
  frequency: z.enum(FREQUENCIES).nullable(),
  result: text(500),
  steps: z.array(requestStepSchema).max(60, 'A request can have at most 60 steps'),
  inputs: z.array(requestInputSchema).max(30),
  rules: text(2000),
  problems: text(2000),
  keepHuman: text(1000),
});
export type RequestContent = z.infer<typeof requestContentSchema>;

export const createRequestSchema = z.object({
  agentId: uuid,
  name: z.string().trim().min(1, 'Name the workflow').max(120),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const saveRequestSchema = requestContentSchema.extend({ expectedVersion: z.number().int().positive() });
export type SaveRequestInput = z.infer<typeof saveRequestSchema>;

export const requestStatusChangeSchema = z.object({ status: z.enum(REQUEST_STATUSES) });
export type RequestStatusChange = z.infer<typeof requestStatusChangeSchema>;

export const convertRequestSchema = z.object({ capabilityId: uuid });
export type ConvertRequestInput = z.infer<typeof convertRequestSchema>;

// ------------------------------------------------------------- files

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** What a workspace may store in total on the free plan. */
export const WORKSPACE_FILE_BYTES = 100 * 1024 * 1024;

/** The only file types accepted, by extension, with the type they are served as. */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Why a file cannot be attached, or null when it can. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!ALLOWED_FILE_TYPES[fileExtension(file.name)]) {
    return 'Use a PDF, Word, Excel, PowerPoint, CSV, text or image file.';
  }
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'Files can be up to 10 MB.';
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const fileSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  requestInputId: uuid.nullable(),
  uploadedBy: z.string(),
  createdAt: z.string(),
});
export type FileSummary = z.infer<typeof fileSummarySchema>;

// ------------------------------------------------------------- read shapes

const person = z.object({ id: uuid, name: z.string() });

export const requestSummarySchema = z.object({
  id: uuid,
  name: z.string(),
  status: z.enum(REQUEST_STATUSES),
  agentId: uuid,
  author: person,
  stepCount: z.number().int(),
  skillId: uuid.nullable(),
  updatedAt: z.string(),
});
export type RequestSummary = z.infer<typeof requestSummarySchema>;

export const requestDetailSchema = requestContentSchema.extend({
  id: uuid,
  agentId: uuid,
  status: z.enum(REQUEST_STATUSES),
  version: z.number().int(),
  author: person,
  skillId: uuid.nullable(),
  skillName: z.string().nullable(),
  steps: z.array(
    z.object({
      id: uuid,
      roleId: uuid.nullable(),
      otherRole: z.string(),
      action: z.string(),
      place: z.string(),
      isApproval: z.boolean(),
      ifNo: z.string(),
    }),
  ),
  inputs: z.array(z.object({ id: uuid, what: z.string(), who: z.string() })),
  files: z.array(fileSummarySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RequestDetail = z.infer<typeof requestDetailSchema>;

/** Who may edit a request's content: its author or an editor, until it is decided. */
export function canEditRequest(
  request: { status: RequestStatus; authorId: string },
  viewer: { id: string; isEditor: boolean },
): boolean {
  if (request.status === 'approved' || request.status === 'declined') return false;
  return viewer.isEditor || viewer.id === request.authorId;
}
