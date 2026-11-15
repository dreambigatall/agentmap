'use client';

import { can, renameWorkspaceSchema, type WorkspaceDetail } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { notify } from '@/components/ui/overlays';
import { Can } from '@/features/auth/can';
import { NamedList } from '@/features/settings/named-list';
import { fieldErrors } from '@/features/auth/form-errors';
import { ME_KEY, useCurrentWorkspace } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

export default function SettingsPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const { workspace } = useCurrentWorkspace(slug);
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!workspace) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fieldErrors(renameWorkspaceSchema, Object.fromEntries(new FormData(event.currentTarget)));
    if (parsed.errors) return setError(parsed.errors.name);
    setError(null);
    setPending(true);
    try {
      await call<WorkspaceDetail>(
        api.PATCH('/api/w/{workspaceId}', {
          params: { path: { workspaceId: workspace!.id } },
          body: parsed.data,
        }),
      );
      await client.invalidateQueries({ queryKey: ME_KEY });
      notify.success('Workspace renamed');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader title="Workspace" description="The name everyone in this workspace sees." />
        <Can
          level={workspace.level}
          action="settings.edit"
          fallback={
            <div className="space-y-1 px-5 py-4 text-sm">
              <p className="font-medium">{workspace.name}</p>
              <p className="text-muted-foreground">Only admins can rename the workspace.</p>
            </div>
          }
        >
          <form className="space-y-4 px-5 py-4" onSubmit={onSubmit} noValidate>
            <TextField
              key={workspace.name}
              label="Workspace name"
              name="name"
              defaultValue={workspace.name}
              error={error ?? undefined}
              hint={`Web address stays /w/${workspace.slug}, so saved links keep working.`}
            />
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </form>
        </Can>
      </Card>
      <NamedList kind="roles" workspaceId={workspace.id} canEdit={can(workspace.level, 'settings.edit')} />
      <NamedList kind="channels" workspaceId={workspace.id} canEdit={can(workspace.level, 'settings.edit')} />
    </div>
  );
}
