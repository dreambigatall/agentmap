import { describe, expect, it } from 'vitest';
import { currentSignoff, decideSignoffSchema, isSignedOff } from './collaboration';
import { canEditRequest, fileProblem, requestStepSchema } from './requests';

describe('sign-off rules', () => {
  it('counts only an approval of this exact version', () => {
    const list = [
      { status: 'approved' as const, skillVersion: 4 },
      { status: 'pending' as const, skillVersion: 5 },
    ];
    expect(isSignedOff(list, 4)).toBe(true);
    expect(isSignedOff(list, 5)).toBe(false);
  });

  it('prefers an open request, then the newest decision', () => {
    const decided = { status: 'approved' as const, createdAt: '2026-11-02' };
    const open = { status: 'pending' as const, createdAt: '2026-11-01' };
    expect(currentSignoff([decided, open])).toBe(open);
    expect(currentSignoff([{ status: 'outdated' as const, createdAt: '2026-11-01' }, decided])).toBe(decided);
    expect(currentSignoff([])).toBeNull();
  });

  it('needs a reason when asking for changes', () => {
    expect(decideSignoffSchema.safeParse({ decision: 'changes', note: '' }).success).toBe(false);
    expect(decideSignoffSchema.safeParse({ decision: 'approve' }).success).toBe(true);
  });
});

describe('requests', () => {
  it('needs someone to do each step', () => {
    const base = { roleId: null, action: 'Checks the PI', isApproval: false };
    expect(requestStepSchema.safeParse(base).success).toBe(false);
    expect(requestStepSchema.safeParse({ ...base, otherRole: 'Sourcing officer' }).success).toBe(true);
  });

  it('lets the author or an editor edit until it is decided', () => {
    const request = { status: 'in_review' as const, authorId: 'a' };
    expect(canEditRequest(request, { id: 'a', isEditor: false })).toBe(true);
    expect(canEditRequest(request, { id: 'b', isEditor: false })).toBe(false);
    expect(canEditRequest(request, { id: 'b', isEditor: true })).toBe(true);
    expect(canEditRequest({ ...request, status: 'approved' }, { id: 'a', isEditor: true })).toBe(false);
  });

  it('accepts only the listed file types and sizes', () => {
    expect(fileProblem({ name: 'handover.PDF', size: 2000 })).toBeNull();
    expect(fileProblem({ name: 'script.exe', size: 2000 })).toMatch(/Use a PDF/);
    expect(fileProblem({ name: 'big.xlsx', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(fileProblem({ name: 'empty.txt', size: 0 })).toMatch(/empty/);
  });
});
