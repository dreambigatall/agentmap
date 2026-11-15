'use client';

import type { NamedItem } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { ask, notify } from '@/components/ui/overlays';
import { keys, useChannels, useRoles } from '@/features/agents/queries';
import { NameDialog } from '@/features/agents/name-dialog';
import { api, call } from '@/lib/api/client';

type Kind = 'roles' | 'channels';

const WORDS: Record<Kind, { title: string; one: string; description: string; placeholder: string }> = {
  roles: {
    title: 'Roles',
    one: 'role',
    description: 'The human jobs that can do a step in a skill, such as “Line manager”. They do not need an account.',
    placeholder: 'Procurement officer',
  },
  channels: {
    title: 'Channels',
    one: 'channel',
    description: 'Where your agents talk to people, such as Email or Slack.',
    placeholder: 'WhatsApp',
  },
};

/** One editable list for a workspace's roles or channels. */
export function NamedList({ kind, workspaceId, canEdit }: { kind: Kind; workspaceId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const roles = useRoles(workspaceId);
  const channels = useChannels(workspaceId);
  const query = kind === 'roles' ? roles : channels;
  const words = WORDS[kind];
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [renaming, setRenaming] = useState<NamedItem | null>(null);

  const refresh = () =>
    client.invalidateQueries({ queryKey: kind === 'roles' ? keys.roles(workspaceId) : keys.channels(workspaceId) });

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name) return setError('Enter a name');
    setError(null);
    setPending(true);
    try {
      if (kind === 'roles') {
        await call(api.POST('/api/w/{workspaceId}/roles', { params: { path: { workspaceId } }, body: { name } }));
      } else {
        await call(api.POST('/api/w/{workspaceId}/channels', { params: { path: { workspaceId } }, body: { name } }));
      }
      setFormKey((k) => k + 1);
      await refresh();
      notify.success(`Added ${name}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(item: NamedItem) {
    const yes = await ask({ title: `Delete ${item.name}?`, confirmLabel: `Delete ${words.one}` });
    if (!yes) return;
    try {
      if (kind === 'roles') {
        await call(
          api.DELETE('/api/w/{workspaceId}/roles/{roleId}', { params: { path: { workspaceId, roleId: item.id } } }),
        );
      } else {
        await call(
          api.DELETE('/api/w/{workspaceId}/channels/{channelId}', {
            params: { path: { workspaceId, channelId: item.id } },
          }),
        );
      }
      await refresh();
      notify.success(`Deleted ${item.name}`);
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  async function rename(item: NamedItem, name: string) {
    if (kind === 'roles') {
      await call(
        api.PATCH('/api/w/{workspaceId}/roles/{roleId}', {
          params: { path: { workspaceId, roleId: item.id } },
          body: { name },
        }),
      );
    } else {
      await call(
        api.PATCH('/api/w/{workspaceId}/channels/{channelId}', {
          params: { path: { workspaceId, channelId: item.id } },
          body: { name },
        }),
      );
    }
    await refresh();
  }

  return (
    <Card>
      <CardHeader title={words.title} description={words.description} />
      {query.isPending && <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>}
      <ul className="divide-y divide-border">
        {query.data?.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              {item.usedBy === 0 ? 'Not used yet' : `Used ${item.usedBy} ${item.usedBy === 1 ? 'time' : 'times'}`}
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setRenaming(item)}>
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  disabled={item.usedBy > 0}
                  title={item.usedBy > 0 ? 'Used in skills. Change those first.' : undefined}
                  onClick={() => remove(item)}
                >
                  Delete
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form key={formKey} onSubmit={add} noValidate className="flex items-start gap-2 border-t border-border px-5 py-3">
          <TextField
            className="flex-1"
            label={`New ${words.one}`}
            hideLabel
            name="name"
            placeholder={words.placeholder}
            maxLength={60}
            error={error ?? undefined}
          />
          <Button type="submit" variant="secondary" loading={pending}>
            Add
          </Button>
        </form>
      )}
      {renaming && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title={`Rename ${renaming.name}`}
          description={renaming.usedBy > 0 ? 'Every skill that uses it shows the new name.' : undefined}
          label="Name"
          initial={renaming.name}
          submitLabel="Save"
          onSubmit={(name) => rename(renaming, name)}
        />
      )}
    </Card>
  );
}
