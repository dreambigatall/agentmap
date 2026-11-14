'use client';

import { PASSWORD_MIN, passwordSchema } from '@skillflow/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/field';
import { api, call } from '@/lib/api/client';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const check = passwordSchema.safeParse(password);
    if (!check.success) return setError(check.error.issues[0].message);
    if (password !== form.get('confirm')) return setError('The two passwords do not match');
    setError(null);
    setPending(true);
    try {
      await call(api.POST('/api/auth/reset-password', { body: { token, password } }));
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return <Alert tone="error">This reset link is incomplete. Open the link from the email again.</Alert>;
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">Your password is changed. You were signed out on every device.</Alert>
        <Link href="/sign-in" className="block">
          <Button className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN} characters.`}
      />
      <PasswordField label="Type it again" name="confirm" autoComplete="new-password" />
      <Button type="submit" className="w-full" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
