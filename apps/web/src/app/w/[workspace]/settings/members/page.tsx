'use client';

import {
  ASSIGNABLE_LEVELS,
  can,
  createInviteSchema,
  type Invite,
  type Level,
  type Member,
  type WorkspaceSummary,
} from '@skillflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField, TextField, type Choice } from '@/components/ui/field';
import { ask, notify } from '@/components/ui/overlays';
import { Can } from '@/features/auth/can';
import { fieldErrors } from '@/features/auth/form-errors';
import { ME_KEY, useCurrentWorkspace } from '@/features/auth/use-me';
import { api, call } from '@/lib/api/client';

type Assignable = (typeof ASSIGNABLE_LEVELS)[number];

const LEVEL_LABEL: Record<Level, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  reviewer: 'Reviewer',
};

const LEVEL_CHOICES: Choice<Assignable>[] = [
  { value: 'reviewer', label: 'Reviewer', description: 'Reads, comments and signs off. Free on every plan.' },
  { value: 'editor', label: 'Editor', description: 'Designs agents and skills, reviews requests.' },
  { value: 'admin', label: 'Admin', description: 'Everything an editor does, plus members and settings.' },
];

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MembersPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);
  if (!workspace || !me.data) return null;
  return <Members workspace={workspace} myUserId={me.data.id} />;
}

function Members({ workspace, myUserId }: { workspace: WorkspaceSummary; myUserId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const path = { workspaceId: workspace.id };
  const membersKey = ['members', workspace.id];
  const invitesKey = ['invites', workspace.id];
  const isAdmin = can(workspace.level, 'members.manage');
  const [busy, setBusy] = useState(false);

  const members = useQuery({
    queryKey: membersKey,
    queryFn: () => call<Member[]>(api.GET('/api/w/{workspaceId}/members', { params: { path } })),
  });
  const invites = useQuery({
    queryKey: invitesKey,
    queryFn: () => call<Invite[]>(api.GET('/api/w/{workspaceId}/invites', { params: { path } })),
    enabled: isAdmin,
  });

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: membersKey }),
      client.invalidateQueries({ queryKey: invitesKey }),
    ]);

  /** Runs one change, shows the outcome as a toast, and reloads the lists. */
  async function run(work: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await work();
      if (success) notify.success(success);
      await refresh();
    } catch (error) {
      notify.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function changeLevel(member: Member, level: Assignable) {
    if (level === member.level) return;
    void run(
      () =>
        call(
          api.PATCH('/api/w/{workspaceId}/members/{memberId}', {
            params: { path: { ...path, memberId: member.id } },
            body: { level },
          }),
        ),
      `${member.name} now has ${LEVEL_LABEL[level]} access`,
    );
  }

  async function remove(member: Member, leaving: boolean) {
    const yes = await ask(
      leaving
        ? {
            title: `Leave ${workspace.name}?`,
            description: 'You lose access until someone invites you again.',
            confirmLabel: 'Leave workspace',
          }
        : {
            title: `Remove ${member.name}?`,
            description: `They lose access to ${workspace.name}. Everything they wrote stays.`,
            confirmLabel: 'Remove',
          },
    );
    if (!yes) return;
    await run(async () => {
      await call(
        api.DELETE('/api/w/{workspaceId}/members/{memberId}', {
          params: { path: { ...path, memberId: member.id } },
        }),
      );
      if (leaving) {
        await client.invalidateQueries({ queryKey: ME_KEY });
        router.replace('/w');
      }
    }, leaving ? `You left ${workspace.name}` : `${member.name} was removed`);
  }

  async function transfer(member: Member) {
    const yes = await ask({
      title: `Make ${member.name} the owner?`,
      description: `They get full control of ${workspace.name}, including billing. You become an admin.`,
      confirmLabel: 'Transfer ownership',
    });
    if (!yes) return;
    await run(async () => {
      await call(
        api.POST('/api/w/{workspaceId}/members/{memberId}/transfer-ownership', {
          params: { path: { ...path, memberId: member.id } },
        }),
      );
      await client.invalidateQueries({ queryKey: ME_KEY });
    }, `${member.name} is now the owner`);
  }

  async function cancelInvite(invite: Invite) {
    const yes = await ask({
      title: `Cancel the invite to ${invite.email}?`,
      description: 'Their link stops working. You can invite them again later.',
      confirmLabel: 'Cancel invite',
      cancelLabel: 'Keep it',
    });
    if (!yes) return;
    await run(
      () =>
        call(
          api.DELETE('/api/w/{workspaceId}/invites/{inviteId}', {
            params: { path: { ...path, inviteId: invite.id } },
          }),
        ),
      'Invite cancelled',
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-muted-foreground">Who can see and change {workspace.name}.</p>
      </div>

      <Can level={workspace.level} action="members.manage">
        <InviteForm
          workspaceId={workspace.id}
          onSent={(email) => {
            notify.success(`Invite sent to ${email}`, { description: 'The link works for 7 days.' });
            void refresh();
          }}
        />
      </Can>

      <Card>
        <CardHeader
          title="People"
          description={members.data ? `${members.data.length} in this workspace` : undefined}
        />
        {members.isPending && <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>}
        {members.isError && <p className="px-5 py-4 text-sm text-danger">{members.error.message}</p>}
        <ul className="divide-y divide-border">
          {members.data?.map((member) => {
            const isMe = member.userId === myUserId;
            const isOwner = member.level === 'owner';
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-medium">
                    {member.name} {isMe && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
                <p className="hidden w-28 text-xs text-muted-foreground lg:block">
                  Last seen {formatDate(member.lastSeenAt)}
                </p>
                <div className="w-36">
                  {isAdmin && !isOwner && !isMe ? (
                    <SelectField<Assignable>
                      label={`Access for ${member.name}`}
                      hideLabel
                      items={LEVEL_CHOICES}
                      value={member.level as Assignable}
                      disabled={busy}
                      onValueChange={(level) => changeLevel(member, level)}
                    />
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {LEVEL_LABEL[member.level]}
                    </span>
                  )}
                </div>
                <div className="flex w-full justify-end gap-2 sm:w-auto">
                  {workspace.level === 'owner' && member.level === 'admin' && (
                    <Button variant="secondary" size="sm" onClick={() => transfer(member)} disabled={busy}>
                      Make owner
                    </Button>
                  )}
                  {isMe && !isOwner && (
                    <Button variant="danger" size="sm" onClick={() => remove(member, true)} disabled={busy}>
                      Leave
                    </Button>
                  )}
                  {isAdmin && !isMe && !isOwner && (
                    <Button variant="danger" size="sm" onClick={() => remove(member, false)} disabled={busy}>
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader title="Pending invites" description="Links work for 7 days. Resending starts a new 7 days." />
          {invites.data?.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No invites waiting.</p>}
          <ul className="divide-y divide-border">
            {invites.data?.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {LEVEL_LABEL[invite.level]} · invited by {invite.invitedBy} · expires {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          call(
                            api.POST('/api/w/{workspaceId}/invites/{inviteId}/resend', {
                              params: { path: { ...path, inviteId: invite.id } },
                            }),
                          ),
                        `New link sent to ${invite.email}`,
                      )
                    }
                  >
                    Resend
                  </Button>
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => cancelInvite(invite)}>
                    Cancel invite
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function InviteForm({ workspaceId, onSent }: { workspaceId: string; onSent: (email: string) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [level, setLevel] = useState<Assignable>('editor');
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { email: new FormData(event.currentTarget).get('email'), level };
    const parsed = fieldErrors(createInviteSchema, values);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    try {
      await call(api.POST('/api/w/{workspaceId}/invites', { params: { path: { workspaceId } }, body: parsed.data }));
      setFormKey((k) => k + 1);
      setLevel('editor');
      onSent(parsed.data.email);
    } catch (e) {
      setErrors({ email: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Invite someone" description="They get an email with a link to join." />
      <form key={formKey} className="space-y-3 px-5 py-4" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextField
            className="flex-1"
            label="Email"
            name="email"
            type="email"
            placeholder="name@company.com"
            error={errors.email}
          />
          <SelectField<Assignable>
            className="sm:w-40"
            label="Access"
            items={LEVEL_CHOICES}
            value={level}
            onValueChange={setLevel}
          />
          <Button type="submit" loading={pending} className="sm:mt-6">
            Send invite
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {LEVEL_CHOICES.find((choice) => choice.value === level)?.description}
        </p>
      </form>
    </Card>
  );
}
