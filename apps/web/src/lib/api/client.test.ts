import { describe, expect, it } from 'vitest';
import { errorMessage, isSignedInArea } from './client';

describe('isSignedInArea', () => {
  it('covers workspace pages and onboarding', () => {
    expect(isSignedInArea('/w')).toBe(true);
    expect(isSignedInArea('/w/acme/settings/members')).toBe(true);
    expect(isSignedInArea('/onboarding')).toBe(true);
  });

  it('leaves public pages alone, so an invite link never bounces to sign-in', () => {
    expect(isSignedInArea('/invite/abc')).toBe(false);
    expect(isSignedInArea('/sign-in')).toBe(false);
    expect(isSignedInArea('/verify-email')).toBe(false);
    expect(isSignedInArea('/workshop')).toBe(false);
  });
});

describe('errorMessage', () => {
  it('reads Nest and validation error bodies', () => {
    expect(errorMessage({ message: 'Email or password is not correct' })).toBe('Email or password is not correct');
    expect(errorMessage({ message: 'Validation failed', errors: [{ message: 'Enter a valid email address' }] })).toBe(
      'Enter a valid email address',
    );
    expect(errorMessage(undefined)).toMatch(/Something went wrong/);
  });
});
