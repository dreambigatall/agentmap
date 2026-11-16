import { describe, expect, it } from 'vitest';
import { exportFileName, searchQuerySchema, searchResultPath, shareTokenSchema } from './sharing';

const id = '7b8f2c1e-1d2a-4c3b-9e8f-1a2b3c4d5e6f';

describe('sharing helpers', () => {
  it('accepts only 43-character base64url tokens', () => {
    expect(shareTokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
    expect(shareTokenSchema.safeParse('a'.repeat(42)).success).toBe(false);
    expect(shareTokenSchema.safeParse(`${'a'.repeat(42)}/`).success).toBe(false);
  });

  it('makes a safe export file name', () => {
    expect(exportFileName('Monthly KPI / scoring!')).toBe('monthly-kpi-scoring.skillflow.json');
    expect(exportFileName('***')).toBe('skill.skillflow.json');
  });

  it('needs two characters to search', () => {
    expect(searchQuerySchema.safeParse({ q: ' a ' }).success).toBe(false);
    expect(searchQuerySchema.parse({ q: ' kpi ' }).q).toBe('kpi');
  });

  it('links each result type', () => {
    const base = { id, title: 'x', context: '', agentId: id };
    expect(searchResultPath('demo', { ...base, type: 'request', skillId: null })).toBe(`/w/demo/requests/${id}`);
    expect(searchResultPath('demo', { ...base, type: 'step', skillId: id })).toBe(`/w/demo/skills/${id}`);
    expect(searchResultPath('demo', { ...base, type: 'agent', skillId: null })).toBe(`/w/demo/agents/${id}`);
  });
});
