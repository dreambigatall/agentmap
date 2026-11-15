'use client';

import { can, type Comment, type CommentTarget, type Level } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/controls';
import { SelectField } from '@/components/ui/field';
import { ask, notify } from '@/components/ui/overlays';
import { api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { collabKeys, useComments, useMembers } from './queries';

const WHOLE = '__whole';

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Comments on a skill or a request, optionally on one step. Open and resolved
 * threads are kept apart; mentioning someone notifies them.
 */
export function CommentsPanel({
  workspaceId,
  targetType,
  targetId,
  steps,
  me,
  level,
}: {
  workspaceId: string;
  targetType: CommentTarget;
  targetId: string;
  /** Steps that can be commented on, with a short label each. */
  steps: Array<{ id: string; label: string }>;
  me: { id: string };
  level: Level;
}) {
  const client = useQueryClient();
  const comments = useComments(workspaceId, targetType, targetId);
  const members = useMembers(workspaceId);
  const [show, setShow] = useState<'open' | 'resolved'>('open');
  const [body, setBody] = useState('');
  const [stepId, setStepId] = useState<string>(WHOLE);
  const [mentions, setMentions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const key = collabKeys.comments(workspaceId, targetType, targetId);

  const stepLabel = useMemo(() => new Map(steps.map((s) => [s.id, s.label])), [steps]);
  const open = comments.data?.filter((c) => !c.resolved) ?? [];
  const resolved = comments.data?.filter((c) => c.resolved) ?? [];
  const visible = show === 'open' ? open : resolved;
  const others = (members.data ?? []).filter((m) => m.userId !== me.id && !mentions.includes(m.userId));

  async function send() {
    if (!body.trim()) return setError('Write a comment');
    setError(null);
    setSending(true);
    try {
      await call(
        api.POST('/api/w/{workspaceId}/comments', {
          params: { path: { workspaceId } },
          body: {
            targetType,
            targetId,
            stepId: stepId === WHOLE ? null : stepId,
            body: body.trim(),
            mentions,
          },
        }),
      );
      setBody('');
      setMentions([]);
      setShow('open');
      await client.invalidateQueries({ queryKey: key });
      if (mentions.length) notify.success(`Comment sent. ${mentions.length === 1 ? 'They were' : 'Everyone mentioned was'} notified.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function act(run: () => Promise<unknown>) {
    try {
      await run();
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  const path = (commentId: string) => ({ params: { path: { workspaceId, commentId } } });

  // A render function, not a nested component: a nested component would be rebuilt on
  // every keystroke and the edit box would lose focus while typing.
  function renderComment(comment: Comment) {
    const mine = comment.author.id === me.id;
    const mayResolve = mine || can(level, 'content.edit');
    const onStep = comment.stepId ? stepLabel.get(comment.stepId) ?? 'a removed step' : null;
    return (
      <li key={comment.id} className="space-y-1.5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-semibold">{comment.author.name}</span>
          <span className="text-muted-foreground">{when(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-muted-foreground">(edited)</span>}
          {onStep && (
            <span className={cn('rounded bg-muted px-1.5 py-0.5', !comment.stepId || stepLabel.has(comment.stepId) ? '' : 'italic')}>
              On {onStep}
            </span>
          )}
        </div>
        {editing?.id === comment.id ? (
          <div className="space-y-2">
            <TextAreaField
              label="Edit comment"
              hideLabel
              value={editing.body}
              onValueChange={(value: string) => setEditing({ id: comment.id, body: value })}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  act(async () => {
                    await call(api.PATCH('/api/w/{workspaceId}/comments/{commentId}', { ...path(comment.id), body: { body: editing.body } }));
                    setEditing(null);
                  })
                }
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
        )}
        {comment.mentions.length > 0 && (
          <p className="text-xs text-muted-foreground">Notified {comment.mentions.map((m) => m.name).join(', ')}</p>
        )}
        {comment.resolved && comment.resolvedBy && (
          <p className="text-xs text-muted-foreground">Resolved by {comment.resolvedBy}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {mayResolve && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                act(() =>
                  comment.resolved
                    ? call(api.POST('/api/w/{workspaceId}/comments/{commentId}/reopen', path(comment.id)))
                    : call(api.POST('/api/w/{workspaceId}/comments/{commentId}/resolve', path(comment.id))),
                )
              }
            >
              {comment.resolved ? 'Reopen' : 'Resolve'}
            </Button>
          )}
          {mine && !comment.resolved && editing?.id !== comment.id && (
            <Button variant="ghost" size="sm" onClick={() => setEditing({ id: comment.id, body: comment.body })}>
              Edit
            </Button>
          )}
          {mine && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={async () => {
                if (await ask({ title: 'Delete this comment?', confirmLabel: 'Delete' })) {
                  await act(() => call(api.DELETE('/api/w/{workspaceId}/comments/{commentId}', path(comment.id))));
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <section aria-labelledby={`comments-${targetId}`} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`comments-${targetId}`} className="text-sm font-semibold">
          Comments
        </h2>
        <div role="group" aria-label="Show comments" className="inline-flex rounded-lg border border-border p-0.5">
          {(['open', 'resolved'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={show === value}
              onClick={() => setShow(value)}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
            >
              {value === 'open' ? `Open (${open.length})` : `Resolved (${resolved.length})`}
            </button>
          ))}
        </div>
      </div>

      {comments.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {comments.data && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {show === 'open' ? 'No open comments. Ask a question or suggest a change below.' : 'Nothing resolved yet.'}
        </p>
      )}
      <ul className="divide-y divide-border">
        {visible.map((comment) => renderComment(comment))}
      </ul>

      <div className="space-y-2 border-t border-border pt-3">
        <TextAreaField
          label="New comment"
          hideLabel
          value={body}
          onValueChange={(value: string) => setBody(value)}
          placeholder="Ask a question or suggest a change"
          error={error ?? undefined}
          onKeyDown={(event: React.KeyboardEvent) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField
            label="About"
            items={[{ value: WHOLE, label: 'The whole item' }, ...steps.map((s) => ({ value: s.id, label: s.label }))]}
            value={stepId}
            onValueChange={setStepId}
          />
          {others.length > 0 && (
            <SelectField
              key={mentions.join(',')}
              label="Notify someone"
              items={others.map((m) => ({ value: m.userId, label: m.name }))}
              onValueChange={(userId) => setMentions((list) => [...list, userId])}
            />
          )}
        </div>
        {mentions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="People to notify">
            {mentions.map((id) => {
              const person = members.data?.find((m) => m.userId === id);
              return (
                <li key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs">
                  {person?.name ?? 'Someone'}
                  <button
                    type="button"
                    aria-label={`Do not notify ${person?.name ?? 'them'}`}
                    className="grid size-4 place-items-center rounded-full hover:bg-border"
                    onClick={() => setMentions((list) => list.filter((m) => m !== id))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Ctrl+Enter to send</span>
          <Button size="sm" onClick={send} loading={sending}>
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}
