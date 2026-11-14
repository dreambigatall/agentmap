import { can, type Action, type Level } from '@skillflow/shared';
import type { ReactNode } from 'react';

/**
 * Shows its children only when the level may perform the action. Uses the same
 * permission table as the API, so the screen never offers what the API would refuse.
 */
export function Can({
  level,
  action,
  children,
  fallback = null,
}: {
  level: Level | undefined;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{level && can(level, action) ? children : fallback}</>;
}
