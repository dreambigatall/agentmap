'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function resend() {
    setState('sending');
    try {
      await call(api.POST('/api/auth/resend-verification'));
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <Alert tone="warning" className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <span>
        {state === 'sent'
          ? `A new link is on its way to ${email}.`
          : `Confirm ${email} to invite teammates. Check your inbox for the link.`}
      </span>
      {state !== 'sent' && (
        <Button variant="secondary" size="sm" onClick={resend} loading={state === 'sending'}>
          {state === 'failed' ? 'Try again' : 'Send a new link'}
        </Button>
      )}
    </Alert>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);

  if (me.isPending) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (me.isError) return <p className="p-8 text-sm text-danger">{me.error.message}</p>;

  if (!workspace) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8">
        <h1 className="text-xl font-semibold">Workspace not found</h1>
        <p className="text-sm text-muted-foreground">
          It does not exist, or you are not a member. Ask an admin of that workspace for an invite.
        </p>
        <Link href="/w" className="text-sm font-medium text-primary hover:underline">
          Go to your workspaces
        </Link>
      </div>
    );
  }

  return (
    <AppShell me={me.data} workspace={workspace}>
      {!me.data.emailVerified && <VerifyBanner email={me.data.email} />}
      {children}
    </AppShell>
  );
}
