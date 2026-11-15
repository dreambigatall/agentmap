'use client';

import {
  can,
  currentSignoff,
  type Level,
  type Signoff,
} from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/controls';
import { AppDialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { notify } from '@/components/ui/overlays';
import { api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { collabKeys, useMembers, useSignoffs } from './queries';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Business-owner sign-off for one skill. An editor asks a named member; only that
 * person approves or asks for changes; any later save makes the approval outdated.
 */
export function SignoffCard({
  workspaceId,
  level,
  me,
  skill,
  dirty = false,
}: {
  workspaceId: string;
  level: Level;
  me: { id: string };
  skill: { id: string; name: string; version: number; status: string };
  /** Unsaved edits in the editor: asking would sign off an older version. */
  dirty?: boolean;
}) {
  const client = useQueryClient();
  const signoffs = useSignoffs(workspaceId, skill.id);
  const members = useMembers(workspaceId);
  const [dialog, setDialog] = useState<null | 'ask' | 'changes'>(null);
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = currentSignoff(signoffs.data ?? []);
  const isEditor = can(level, 'content.edit');
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: collabKeys.signoffs(workspaceId, skill.id) }),
      client.invalidateQueries({ queryKey: collabKeys.notifications(workspaceId) }),
    ]);

  async function run(work: () => Promise<Signoff>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await refresh();
      notify.success(success);
      setDialog(null);
      setNote('');
    } catch (e) {
      setError((e as Error).message);
      if (!dialog) notify.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const askFor = () =>
    run(
      () =>
        call<Signoff>(
          api.POST('/api/w/{workspaceId}/skills/{skillId}/signoffs', {
            params: { path: { workspaceId, skillId: skill.id } },
            body: { ownerId: ownerId! },
          }),
        ),
      'Sign-off requested. They have been notified.',
    );

  const decide = (decision: 'approve' | 'changes') =>
    run(
      () =>
        call<Signoff>(
          api.POST('/api/w/{workspaceId}/signoffs/{signoffId}/decide', {
            params: { path: { workspaceId, signoffId: current!.id } },
            body: { decision, note },
          }),
        ),
      decision === 'approve' ? `You signed off version ${skill.version}` : 'Changes asked. They have been notified.',
    );

  const cancel = () =>
    run(
      () =>
        call<Signoff>(
          api.POST('/api/w/{workspaceId}/signoffs/{signoffId}/cancel', {
            params: { path: { workspaceId, signoffId: current!.id } },
          }),
        ),
      'Sign-off request cancelled',
    );

  const candidates = (members.data ?? []).filter((m) => m.userId !== me.id);
  const pending = current?.status === 'pending' ? current : null;
  const approvedHere = current?.status === 'approved' && current.skillVersion === skill.version ? current : null;
  const canAsk = isEditor && skill.status === 'defined' && !pending && !approvedHere;

  return (
    <section aria-labelledby={`signoff-${skill.id}`} className="space-y-3">
      <h2 id={`signoff-${skill.id}`} className="text-sm font-semibold">
        Business owner sign-off
      </h2>

      {signoffs.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {signoffs.data && !current && <p className="text-sm text-muted-foreground">Not asked yet.</p>}

      {pending && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p>
            <span className="font-medium">Waiting for {pending.owner.id === me.id ? 'you' : pending.owner.name}</span>{' '}
            to sign off version {pending.skillVersion}.
          </p>
          <p className="text-xs text-muted-foreground">
            Asked by {pending.requestedBy.name} on {when(pending.createdAt)}
          </p>
          {pending.owner.id === me.id && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" loading={busy} onClick={() => decide('approve')}>
                Approve version {pending.skillVersion}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog('changes')}>
                Ask for changes
              </Button>
            </div>
          )}
          {(pending.requestedBy.id === me.id || isEditor) && pending.owner.id !== me.id && (
            <Button size="sm" variant="ghost" onClick={cancel} loading={busy}>
              Cancel request
            </Button>
          )}
        </div>
      )}

      {!pending && current && (
        <div
          className={cn(
            'space-y-1 rounded-lg border p-3 text-sm',
            approvedHere ? 'border-success/40 bg-success/10' : 'border-border',
          )}
        >
          {current.status === 'approved' && approvedHere && (
            <p>
              <span className="font-medium">Signed off by {current.owner.name}</span> on {when(current.decidedAt!)}. It can
              move to In build.
            </p>
          )}
          {current.status === 'approved' && !approvedHere && (
            <p>
              {current.owner.name} signed off version {current.skillVersion}. It has changed since, so it needs a new
              sign-off.
            </p>
          )}
          {current.status === 'outdated' && (
            <p>The sign-off for version {current.skillVersion} is outdated: the skill changed after it was asked.</p>
          )}
          {current.status === 'changes_asked' && (
            <>
              <p>
                <span className="font-medium">{current.owner.name} asked for changes</span> to version {current.skillVersion}:
              </p>
              <p className="text-muted-foreground">“{current.note}”</p>
            </>
          )}
          {current.status === 'cancelled' && <p className="text-muted-foreground">The last request was cancelled.</p>}
          {current.note && current.status === 'approved' && (
            <p className="text-xs text-muted-foreground">“{current.note}”</p>
          )}
        </div>
      )}

      {isEditor && !pending && !approvedHere && (
        <div className="space-y-1">
          <Button
            size="sm"
            variant="secondary"
            disabled={!canAsk || dirty}
            onClick={() => {
              setError(null);
              setOwnerId(undefined);
              setDialog('ask');
            }}
          >
            Ask for sign-off
          </Button>
          {!canAsk && skill.status !== 'defined' && (
            <p className="text-xs text-muted-foreground">Move the skill to Defined first.</p>
          )}
          {canAsk && dirty && <p className="text-xs text-muted-foreground">Save your changes first.</p>}
        </div>
      )}

      {dialog === 'ask' && (
        <AppDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Ask for sign-off"
          description={`The business owner approves version ${skill.version} of “${skill.name}” before it is built. They get an email.`}
        >
          <div className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Invite the business owner to this workspace first. Reviewer access is enough, and free.
              </p>
            ) : (
              <SelectField
                label="Business owner"
                items={candidates.map((m) => ({ value: m.userId, label: `${m.name} · ${m.email}` }))}
                value={ownerId}
                onValueChange={setOwnerId}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button disabled={!ownerId} loading={busy} onClick={askFor}>
                Ask for sign-off
              </Button>
            </div>
          </div>
        </AppDialog>
      )}

      {dialog === 'changes' && (
        <AppDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Ask for changes"
          description="Say what needs to change. The person who asked is notified."
        >
          <div className="space-y-4">
            <TextAreaField
              label="What needs to change"
              value={note}
              onValueChange={(value: string) => setNote(value)}
              rows={4}
              error={error ?? undefined}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button loading={busy} disabled={!note.trim()} onClick={() => decide('changes')}>
                Send
              </Button>
            </div>
          </div>
        </AppDialog>
      )}
    </section>
  );
}
