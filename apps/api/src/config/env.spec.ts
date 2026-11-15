import { parseEnv } from './env';

const base = {
  DATABASE_URL: 'postgresql://a:b@host:6543/postgres',
  DIRECT_URL: 'postgresql://a:b@host:5432/postgres',
  JWT_SECRET: 'x'.repeat(40),
};

describe('parseEnv', () => {
  it('fills defaults when only the required values are given', () => {
    const env = parseEnv(base);
    expect(env.API_PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it('treats an empty Resend key as not set', () => {
    expect(parseEnv({ ...base, RESEND_API_KEY: '' }).RESEND_API_KEY).toBeUndefined();
  });

  it('explains what is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL is missing/);
  });

  it('rejects a short signing secret', () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });
});
