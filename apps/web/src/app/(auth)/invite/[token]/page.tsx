'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteLookup } from '@skillflow/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ME_KEY, useMe } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

const levelWords: Record<InviteLookup['level'], string> = {
  owner: 'owner',
  admin: 'an admin',
  editor: 'an editor',
  reviewer: 'a reviewer',
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => call<InviteLookup>(api.GET('/api/invites/{token}', { params: { path: { token } } })),
    retry: false,
  });

  async function accept() {
    setPending(true);
    setError(null);
    try {
      const result = await call<{ workspaceSlug: string }>(api.POST('/api/invites/accept', { body: { token } }));
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.replace(`/w/${result.workspaceSlug}`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  if (invite.isPending) return <p className="text-sm text-muted-foreground">Opening your invite…</p>;
  if (invite.isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Invite not found</h1>
        <Alert tone="error">{invite.error.message}</Alert>
      </div>
    );
  }

  const data = invite.data;
  const signedIn = me.isSuccess;
  const here = `/invite/${token}`;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Join {data.workspaceName}</h1>
        <p className="text-sm text-muted-foreground">
          {data.invitedBy} invited <strong className="text-foreground">{data.email}</strong> to join as{' '}
          {levelWords[data.level]}.
        </p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      {signedIn ? (
        me.data.email === data.email ? (
          <Button className="w-full" onClick={accept} loading={pending}>
            Accept and open {data.workspaceName}
          </Button>
        ) : (
          <Alert tone="warning">
            You are signed in as {me.data.email}. Sign out and sign in as {data.email} to accept.
          </Alert>
        )
      ) : data.hasAccount ? (
        <Link href={`/sign-in?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(here)}`} className="block">
          <Button className="w-full">Sign in to accept</Button>
        </Link>
      ) : (
        <Link
          href={`/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(data.email)}`}
          className="block"
        >
          <Button className="w-full">Create your account</Button>
        </Link>
      )}
    </div>
  );
}
