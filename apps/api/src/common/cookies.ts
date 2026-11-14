import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'sf_access';
export const REFRESH_COOKIE = 'sf_refresh';
/** Carries no secret. Lets the web app's middleware know a session may exist. */
export const SESSION_COOKIE = 'sf_session';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/** The refresh token is only ever sent to the auth routes. */
const REFRESH_PATH = '/api/auth';

function base(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax' };
}

export function setSessionCookies(
  res: Response,
  tokens: { access: string; refresh: string },
  secure: boolean,
): void {
  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...base(secure),
    path: '/',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...base(secure),
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
  res.cookie(SESSION_COOKIE, '1', {
    ...base(secure),
    path: '/',
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(secure), path: REFRESH_PATH });
  res.clearCookie(SESSION_COOKIE, { ...base(secure), path: '/' });
}
