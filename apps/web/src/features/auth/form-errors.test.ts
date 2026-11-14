import { signUpSchema } from '@skillflow/shared';
import { describe, expect, it } from 'vitest';
import { fieldErrors } from './form-errors';

describe('fieldErrors', () => {
  it('returns parsed data when valid', () => {
    const result = fieldErrors(signUpSchema, { name: 'A', email: 'A@B.co', password: 'long-enough-1' });
    expect(result.errors).toBeNull();
    expect(result.data?.email).toBe('a@b.co');
  });

  it('returns one message per field', () => {
    const result = fieldErrors(signUpSchema, { name: '', email: 'nope', password: 'x' });
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(['email', 'name', 'password']);
  });
});
