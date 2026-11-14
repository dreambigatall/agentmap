import {
  acceptInviteResultSchema,
  changeLevelSchema,
  createInviteSchema,
  createWorkspaceSchema,
  inviteLookupSchema,
  inviteSchema,
  memberSchema,
  renameWorkspaceSchema,
  tokenSchema,
  workspaceSchema,
  workspaceSummarySchema,
} from '@skillflow/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateWorkspaceDto extends createZodDto(createWorkspaceSchema) {}
export class RenameWorkspaceDto extends createZodDto(renameWorkspaceSchema) {}
export class WorkspaceSummaryDto extends createZodDto(workspaceSummarySchema) {}
export class WorkspaceDto extends createZodDto(workspaceSchema) {}

export class MemberDto extends createZodDto(memberSchema) {}
export class ChangeLevelDto extends createZodDto(changeLevelSchema) {}

export class CreateInviteDto extends createZodDto(createInviteSchema) {}
export class InviteDto extends createZodDto(inviteSchema) {}
export class InviteLookupDto extends createZodDto(inviteLookupSchema) {}
export class AcceptInviteDto extends createZodDto(tokenSchema) {}
export class AcceptInviteResultDto extends createZodDto(acceptInviteResultSchema) {}
