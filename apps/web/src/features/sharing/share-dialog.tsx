'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppDialog } from '@/components/ui/dialog';
import { ask, notify } from '@/components/ui/overlays';
import { api, call } from '@/lib/api/client';
import { shareKeys, shareUrl, useShareLinks } from './queries';

/** Makes, copies and turns off public read-only links to one agent. */
export function ShareDialog({
  open,
  onOpenChange,
  workspaceId,
  agentId,
  agentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  agentId: string;
  agentName: string;
}) {
  const client = useQueryClient();
  const links = useShareLinks(workspaceId, agentId, open);
  const [busy, setBusy] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: shareKeys.links(workspaceId, agentId) });

  async function create() {
    setBusy(true);
    try {
      const link = await call(
        api.POST('/api/w/{workspaceId}/agents/{agentId}/shares', { params: { path: { workspaceId, agentId } } }),
      );
      await refresh();
      await copy(link.token);
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      notify.success('Link copied');
    } catch {
      notify.error('Could not copy. Select the link and copy it yourself.');
    }
  }

  async function revoke(shareId: string) {
    const ok = await ask({
      title: 'Turn off this link?',
      description: 'Anyone who has it will see “not available”. You can make a new link any time.',
      confirmLabel: 'Turn off',
    });
    if (!ok) return;
    try {
      await call(api.DELETE('/api/w/{workspaceId}/shares/{shareId}', { params: { path: { workspaceId, shareId } } }));
      await refresh();
      notify.success('Link turned off');
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Share ${agentName}`}
      description="Anyone with a link can read this agent’s skills and flows without an account. Comments, history, requests and people’s names stay private."
    >
      <div className="space-y-4">
        {links.isPending && <p className="text-sm text-muted-foreground">Loading links…</p>}
        {links.isError && <p className="text-sm text-danger">{links.error.message}</p>}
        {links.data && links.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        )}
        <ul className="space-y-3">
          {links.data?.map((link) => (
            <li key={link.id} className="space-y-2 rounded-lg border border-border p-3">
              <input
                readOnly
                aria-label="Share link"
                value={shareUrl(link.token)}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full truncate rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex-1">
                  Made by {link.createdBy} · {link.lastViewedAt ? `last opened ${new Date(link.lastViewedAt).toLocaleDateString()}` : 'not opened yet'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => void copy(link.token)}>
                  Copy
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => void revoke(link.id)}>
                  Turn off
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button onClick={() => void create()} disabled={busy}>
          {busy ? 'Making link…' : 'Make a new link'}
        </Button>
      </div>
    </AppDialog>
  );
}
