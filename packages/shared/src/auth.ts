import { z } from 'zod';
import { LEVELS } from './permissions';

/** Emails are compared lower-case and trimmed everywhere. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const PASSWORD_MIN = 10;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(200, 'Use at most 200 characters');

export const personNameSchema = z.string().trim().min(1, 'Enter your name').max(100);

export const signUpSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  /** Present when signing up from an invite link; proves the email address. */
  inviteToken: z.string().min(20).max(200).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export type TokenInput = z.infer<typeof tokenSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const levelSchema = z.enum(LEVELS);

export const workspaceSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  level: levelSchema,
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
  workspaces: z.array(workspaceSummarySchema),
});
export type Me = z.infer<typeof meSchema>;
