import type { HealthResponse } from '@skillflow/shared';

export type HealthTone = 'success' | 'warning' | 'danger';

/** Turns the API health answer into the words and colour shown in the top bar. */
export function healthLabel(health: HealthResponse | undefined, failed: boolean): {
  text: string;
  tone: HealthTone;
} {
  if (failed) return { text: 'API unreachable', tone: 'danger' };
  if (!health) return { text: 'Checking…', tone: 'warning' };
  if (health.database === 'down') return { text: 'API up · database down', tone: 'warning' };
  return { text: `API ${health.version} · database up`, tone: 'success' };
}
