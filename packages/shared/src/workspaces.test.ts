import { describe, expect, it } from 'vitest';
import { signUpSchema } from './auth';
import { slugify } from './workspaces';

describe('slugify', () => {
  it('makes a readable address part', () => {
    expect(slugify('Acme Support Team')).toBe('acme-support-team');
    expect(slugify('  Café  Ops!! ')).toBe('cafe-ops');
  });

  it('never returns an empty slug', () => {
    expect(slugify('!!!')).toBe('workspace');
  });
});

describe('signUpSchema', () => {
  it('normalises the email', () => {
    const parsed = signUpSchema.parse({
      name: 'Sam',
      email: '  Sam@Example.COM ',
      password: 'long-enough-1',
    });
    expect(parsed.email).toBe('sam@example.com');
  });

  it('rejects short passwords', () => {
    expect(() => signUpSchema.parse({ name: 'Sam', email: 'a@b.co', password: 'short' })).toThrow();
  });
});
