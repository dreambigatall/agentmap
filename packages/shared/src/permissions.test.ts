import { describe, expect, it } from 'vitest';
import { atLeast, can } from './permissions';

describe('permissions', () => {
  it('ranks levels from reviewer up to owner', () => {
    expect(atLeast('owner', 'admin')).toBe(true);
    expect(atLeast('editor', 'admin')).toBe(false);
    expect(atLeast('reviewer', 'reviewer')).toBe(true);
  });

  it('matches the PRD permission table', () => {
    expect(can('owner', 'billing.manage')).toBe(true);
    expect(can('admin', 'billing.manage')).toBe(false);
    expect(can('admin', 'members.manage')).toBe(true);
    expect(can('editor', 'members.manage')).toBe(false);
    expect(can('editor', 'content.edit')).toBe(true);
    expect(can('reviewer', 'content.edit')).toBe(false);
    expect(can('reviewer', 'comments.write')).toBe(true);
    expect(can('reviewer', 'signoffs.decide')).toBe(true);
  });
});
