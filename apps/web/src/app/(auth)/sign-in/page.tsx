'use client';

import { signInSchema, type Me } from '@skillflow/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordField, TextField } from '@/components/ui/field';
import { fieldErrors } from '@/features/auth/form-errors';
import { safeNext } from '@/features/auth/safe-next';
import { useSetMe } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setMe = useSetMe();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = fieldErrors(signInSchema, values);
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const me = await call<Me>(api.POST('/api/auth/sign-in', { body: parsed.data }));
      setMe(me);
      router.replace(safeNext(params.get('next')));
    } catch (error) {
      setFormError((error as Error).message);
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={params.get('email') ?? ''}
          error={errors.email}
          required
        />
        <PasswordField label="Password" name="password" autoComplete="current-password" error={errors.password} />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Agentmap?{' '}
        <Link
          href={params.get('next') ? `/sign-up?next=${encodeURIComponent(params.get('next')!)}` : '/sign-up'}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
