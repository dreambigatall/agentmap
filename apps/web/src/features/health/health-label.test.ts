import { describe, expect, it } from 'vitest';
import { healthLabel } from './health-label';

const base = { status: 'ok', database: 'up', version: '0.1.0', time: '' } as const;

describe('healthLabel', () => {
  it('shows a failure when the API cannot be reached', () => {
    expect(healthLabel(undefined, true)).toEqual({ text: 'API unreachable', tone: 'danger' });
  });

  it('warns when the database is down', () => {
    expect(healthLabel({ ...base, status: 'degraded', database: 'down' }, false).tone).toBe('warning');
  });

  it('is green when everything is up', () => {
    expect(healthLabel(base, false)).toEqual({ text: 'API 0.1.0 · database up', tone: 'success' });
  });
});
