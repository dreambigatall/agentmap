import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/w/acme/settings')).toBe('/w/acme/settings');
  });

  it('refuses other sites and odd values', () => {
    expect(safeNext('https://evil.example')).toBe('/w');
    expect(safeNext('//evil.example')).toBe('/w');
    expect(safeNext('/\\evil.example')).toBe('/w');
    expect(safeNext(null)).toBe('/w');
  });
});
