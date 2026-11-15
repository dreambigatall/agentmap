import { Prisma } from '@prisma/client';

/** True when a write broke a unique rule, e.g. a second role with the same name. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
