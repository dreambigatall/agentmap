'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { ME_KEY } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const client = useQueryClient();
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [message, setMessage] = useState('This link is incomplete. Open the link from the email again.');
  const started = useRef(false);

  useEffect(() => {
    // Run once: the link can be used only once, and React may mount twice in development.
    if (!token || started.current) return;
    started.current = true;
    call(api.POST('/api/auth/verify-email', { body: { token } }))
      .then(() => {
        setState('done');
        void client.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setState('failed');
      });
  }, [token, client]);

  if (state === 'working') return <p className="text-sm text-muted-foreground">Confirming your email…</p>;
  return (
    <div className="space-y-4">
      {state === 'done' ? (
        <Alert tone="success">Your email is confirmed. You can now invite your team.</Alert>
      ) : (
        <Alert tone="error">{message}</Alert>
      )}
      <Link href="/w" className="block text-center text-sm font-medium text-primary hover:underline">
        Go to Skillflow
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Confirm your email</h1>
      <Suspense>
        <Verify />
      </Suspense>
    </>
  );
}
