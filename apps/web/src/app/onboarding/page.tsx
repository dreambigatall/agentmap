'use client';

import { createWorkspaceSchema, type WorkspaceSummary } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { fieldErrors } from '@/features/auth/form-errors';
import { ME_KEY, useMe } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

export default function OnboardingPage() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasWorkspaces = (me.data?.workspaces.length ?? 0) > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fieldErrors(createWorkspaceSchema, Object.fromEntries(new FormData(event.currentTarget)));
    if (parsed.errors) return setError(parsed.errors.name);
    setError(null);
    setPending(true);
    try {
      const workspace = await call<WorkspaceSummary>(api.POST('/api/workspaces', { body: parsed.data }));
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.replace(`/w/${workspace.slug}`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-primary">{hasWorkspaces ? 'New workspace' : 'Welcome'}</p>
        <h1 className="mt-1 text-xl font-semibold">Name your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A workspace holds your team, your agents and their workflows. Usually your company or team name.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {error && !error.startsWith('Use') && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Workspace name"
            name="name"
            placeholder="Acme Support"
            autoFocus
            error={error?.startsWith('Use') ? error : undefined}
          />
          <Button type="submit" className="w-full" loading={pending}>
            Create workspace
          </Button>
        </form>
        {hasWorkspaces && (
          <Link href="/w" className="mt-4 block text-center text-sm text-muted-foreground hover:underline">
            Cancel
          </Link>
        )}
      </div>
    </div>
  );
}
