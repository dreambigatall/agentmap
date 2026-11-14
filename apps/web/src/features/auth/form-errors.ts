import type { ZodSchema } from 'zod';

/** Runs a shared schema in the browser and returns the first problem per field. */
export function fieldErrors<T>(
  schema: ZodSchema<T>,
  values: unknown,
): { data: T; errors: null } | { data: null; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}
