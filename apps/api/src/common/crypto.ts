import { createHash, randomBytes } from 'node:crypto';

/** A random, URL-safe token for links and sessions. 32 bytes = 256 bits. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored only as this hash, so a database leak does not leak working links. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
