import createClient from 'openapi-fetch';
import type { paths } from './schema';

/** Auth routes answer 401 as a normal "no" and must never trigger a refresh. */
const NO_REFRESH = ['/api/auth/sign-in', '/api/auth/sign-up', '/api/auth/refresh', '/api/auth/sign-out'];

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit an expired session together. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * The access cookie lasts 15 minutes. When a request comes back 401, refresh the
 * session once and repeat the request, so people stay signed in without noticing.
 */
async function fetchWithRefresh(input: Request): Promise<Response> {
  const retry = input.clone();
  const response = await fetch(input);
  const path = new URL(input.url).pathname;
  if (response.status !== 401 || NO_REFRESH.includes(path)) return response;

  if (await refreshSession()) return fetch(retry);

  // Only pages that need a session send the person to sign in. Public pages, such as an
  // invite link, ask "who is signed in?" and treat a 401 as "nobody".
  if (typeof window !== 'undefined' && isSignedInArea(window.location.pathname)) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/sign-in?next=${next}`);
  }
  return response;
}

export function isSignedInArea(pathname: string): boolean {
  return pathname === '/w' || pathname.startsWith('/w/') || pathname === '/onboarding';
}

/**
 * Typed client for the NestJS API. Paths, inputs and responses are checked
 * against the API's OpenAPI description; run `pnpm api:client` after changing the API.
 * Requests go to this app's own /api, which Next.js forwards to the API server.
 */
export const api = createClient<paths>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin,
  credentials: 'include',
  fetch: fetchWithRefresh,
});

/** Turns any API error body into one sentence a person can act on. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!error || typeof error !== 'object') return fallback;
  const body = error as { message?: unknown; errors?: Array<{ message?: string }> };
  if (Array.isArray(body.errors) && body.errors[0]?.message) return body.errors[0].message;
  if (typeof body.message === 'string' && body.message !== 'Validation failed') return body.message;
  if (Array.isArray(body.message) && typeof body.message[0] === 'string') return body.message[0];
  return fallback;
}

/** Unwraps an openapi-fetch result: returns the data or throws an Error with a readable message. */
export async function call<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) throw new ApiError(errorMessage(error), response.status);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
