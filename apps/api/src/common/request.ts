import type { Level } from '@skillflow/shared';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
}

export interface WorkspaceAccess {
  workspaceId: string;
  membershipId: string;
  level: Level;
}

/** An Express request after the auth guard (and, under /w/:workspaceId, the workspace guard). */
export interface AppRequest extends Request {
  user?: AuthUser;
  workspace?: WorkspaceAccess;
}
