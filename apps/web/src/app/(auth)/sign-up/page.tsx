'use client';

import { PASSWORD_MIN, signUpSchema, type Me } from '@skillflow/shared';
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

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setMe = useSetMe();
  const inviteToken = params.get('invite') ?? undefined;
  const invitedEmail = params.get('email') ?? '';
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { ...Object.fromEntries(new FormData(event.currentTarget)), inviteToken };
    const parsed = fieldErrors(signUpSchema, values);
    setFormError(null);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      const me = await call<Me>(api.POST('/api/auth/sign-up', { body: parsed.data }));
      setMe(me);
      const joined = me.workspaces[0];
      router.replace(joined ? `/w/${joined.slug}` : safeNext(params.get('next'), '/onboarding'));
    } catch (error) {
      setFormError((error as Error).message);
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold">{inviteToken ? 'Create your account to join' : 'Create your account'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Design and agree how your AI agents should work.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Your name" name="name" autoComplete="name" error={errors.name} required />
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={invitedEmail}
          readOnly={Boolean(inviteToken && invitedEmail)}
          hint={inviteToken && invitedEmail ? 'The address your invite was sent to.' : undefined}
          error={errors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={errors.password}
        />
        <Button type="submit" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
