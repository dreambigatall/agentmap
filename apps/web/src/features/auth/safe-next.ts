/**
 * Only same-site paths are allowed as a place to return to after signing in,
 * so a crafted link cannot send someone to another website.
 */
export function safeNext(value: string | null | undefined, fallback = '/w'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
