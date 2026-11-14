'use client';

import { forgotPasswordSchema } from '@skillflow/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { fieldErrors } from '@/features/auth/form-errors';
import { api, call } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fieldErrors(forgotPasswordSchema, Object.fromEntries(new FormData(event.currentTarget)));
    if (parsed.errors) return setError(parsed.errors.email ?? 'Enter your email');
    setError(null);
    setPending(true);
    try {
      await call(api.POST('/api/auth/forgot-password', { body: parsed.data }));
      setSentTo(parsed.data.email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      {sentTo ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It works for 1 hour.
          </Alert>
          <Link href="/sign-in" className="block text-center text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">We will email you a link to choose a new one.</p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <TextField label="Work email" name="email" type="email" autoComplete="email" error={error ?? undefined} />
            <Button type="submit" className="w-full" loading={pending}>
              Send reset link
            </Button>
          </form>
          <Link href="/sign-in" className="mt-6 block text-center text-sm text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </>
      )}
    </>
  );
}
