'use client';

import {
  atLeast,
  canEditRequest,
  fileProblem,
  formatBytes,
  FREQUENCIES,
  FREQUENCY_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUSES,
  type Frequency,
  type NamedItem,
  type RequestDetail,
  type RequestStatus,
  type SkillDetail,
  type WorkspaceSummary,
} from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { MenuTrigger } from '@ui-sdk/react/menu';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, TextAreaField } from '@/components/ui/controls';
import { AppDialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { AppMenuContent, AppMenuItem, AppMenuSeparator, Chevron, Menu } from '@/components/ui/menu';
import { ask, notify } from '@/components/ui/overlays';
import { AgentBadge } from '@/features/agents/agent-badge';
import { useAgent, useRoles } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { CommentsPanel } from '@/features/collaboration/comments-panel';
import { collabKeys, fileUrl, uploadFile, useRequest } from '@/features/collaboration/queries';
import { RequestStatusPill } from '@/features/collaboration/request-status';
import {
  isRequestDirty,
  newRequestInput,
  newRequestStep,
  OTHER_ROLE,
  toRequestDraft,
  validateRequest,
  type DraftStep,
  type RequestDraft,
} from '@/features/collaboration/request-state';
import { move } from '@/features/skills/editor-state';
import { ApiError, api, call } from '@/lib/api/client';

export default function RequestPage() {
  const { workspace: slug, requestId } = useParams<{ workspace: string; requestId: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);
  const request = useRequest(workspace?.id ?? '', requestId);
  const roles = useRoles(workspace?.id ?? '');
  const agent = useAgent(workspace?.id ?? '', request.data?.agentId ?? '');
  if (!workspace || !me.data) return null;
  if (request.isError) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Request not found</h1>
        <Link href={`/w/${slug}`} className="text-sm font-medium text-primary hover:underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }
  if (!request.data || !roles.data || !agent.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <RequestView
      key={request.data.id}
      initial={request.data}
      workspace={workspace}
      me={{ id: me.data.id }}
      roles={roles.data}
      agent={agent.data}
    />
  );
}

const iconButton =
  'grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30';

function Section({ n, title, help, children }: { n: number; title: string; help: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={`${n}. ${title}`} description={help} />
      <div className="space-y-4 px-5 py-4">{children}</div>
    </Card>
  );
}

function RequestView({
  initial,
  workspace,
  me,
  roles,
  agent,
}: {
  initial: RequestDetail;
  workspace: WorkspaceSummary;
  me: { id: string };
  roles: NamedItem[];
  agent: { id: string; shortName: string; fullName: string; color: import('@skillflow/shared').AgentColor; capabilities: { id: string; name: string }[] };
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<RequestDraft>(() => toRequestDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [capabilityId, setCapabilityId] = useState<string | undefined>(agent.capabilities[0]?.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  const isEditor = atLeast(workspace.level, 'editor');
  const editable = canEditRequest({ status: saved.status, authorId: saved.author.id }, { id: me.id, isEditor });
  const dirty = editable && isRequestDirty(draft, saved);
  const path = { workspaceId: workspace.id, requestId: saved.id };
  const actorItems = [
    ...roles.map((r) => ({ value: r.id, label: r.name })),
    { value: OTHER_ROLE, label: 'Someone else…' },
  ];

  function accept(next: RequestDetail) {
    setSaved(next);
    setDraft(toRequestDraft(next));
    client.setQueryData(collabKeys.request(workspace.id, next.id), next);
    void client.invalidateQueries({ queryKey: ['requests', workspace.id] });
  }
  const update = (patch: Partial<RequestDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateStep = (i: number, patch: Partial<DraftStep>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  async function save() {
    const { body, errors: problems } = validateRequest(draft, saved.version);
    setErrors(problems);
    if (!body) return notify.error('Some fields need attention', { description: Object.values(problems)[0] });
    setSaving(true);
    try {
      accept(await call<RequestDetail>(api.PUT('/api/w/{workspaceId}/requests/{requestId}', { params: { path }, body })));
      setConflict(null);
      notify.success('Saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(e.message);
      else notify.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  async function reload() {
    accept(await call<RequestDetail>(api.GET('/api/w/{workspaceId}/requests/{requestId}', { params: { path } })));
    setConflict(null);
  }

  async function setStatus(status: RequestStatus) {
    if (dirty) return notify.error('Save your changes first');
    try {
      accept(
        await call<RequestDetail>(
          api.POST('/api/w/{workspaceId}/requests/{requestId}/status', { params: { path }, body: { status } }),
        ),
      );
      notify.success(`Status: ${REQUEST_STATUS_LABEL[status]}`);
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  async function convert() {
    if (!capabilityId) return;
    try {
      const skill = await call<SkillDetail>(
        api.POST('/api/w/{workspaceId}/requests/{requestId}/convert', { params: { path }, body: { capabilityId } }),
      );
      await client.invalidateQueries({ queryKey: ['agent', workspace.id] });
      await client.invalidateQueries({ queryKey: ['agents', workspace.id] });
      notify.success('Draft skill created from this request');
      router.push(`/w/${workspace.slug}/skills/${skill.id}`);
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  async function archive() {
    if (!(await ask({ title: `Remove “${saved.name}”?`, confirmLabel: 'Remove request' }))) return;
    try {
      await call(api.DELETE('/api/w/{workspaceId}/requests/{requestId}', { params: { path } }));
      await client.invalidateQueries({ queryKey: ['requests', workspace.id] });
      router.replace(`/w/${workspace.slug}/agents/${agent.id}/requests`);
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  function pickFile(inputId?: string) {
    setUploadFor(inputId);
    fileInput.current?.click();
  }
  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = fileProblem({ name: file.name, size: file.size });
    if (problem) return notify.error(problem);
    setUploading(true);
    try {
      await uploadFile(workspace.id, saved.id, file, uploadFor);
      await reload();
      notify.success(`Attached ${file.name}`);
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function removeFile(fileId: string, name: string) {
    if (!(await ask({ title: `Remove ${name}?`, confirmLabel: 'Remove file' }))) return;
    try {
      await call(api.DELETE('/api/w/{workspaceId}/files/{fileId}', { params: { path: { workspaceId: workspace.id, fileId } } }));
      await reload();
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  const filesFor = (inputId: string | null) => saved.files.filter((f) => f.requestInputId === inputId);
  const fileList = (inputId: string | null) => {
    const files = filesFor(inputId);
    if (!files.length) return null;
    return (
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-sm">
            <a href={fileUrl(workspace.id, f.id)} className="min-w-0 truncate text-primary hover:underline">
              {f.name}
            </a>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(f.size)} · {f.uploadedBy}
            </span>
            {editable && (
              <button type="button" className="ml-auto text-xs text-danger hover:underline" onClick={() => removeFile(f.id, f.name)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const roleName = (id: string | null, other: string) => (id ? roles.find((r) => r.id === id)?.name ?? 'Unknown role' : other);

  return (
    <div className={dirty ? 'mx-auto max-w-6xl space-y-6 pb-20 lg:pb-0' : 'mx-auto max-w-6xl space-y-6'}>
      <header className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <AgentBadge shortName={agent.shortName} color={agent.color} />
          <Link href={`/w/${workspace.slug}/agents/${agent.id}/requests`} className="hover:text-foreground hover:underline">
            {agent.fullName} requests
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{draft.name || 'Untitled request'}</h1>
          <RequestStatusPill status={saved.status} />
          <span className="text-xs text-muted-foreground">
            From {saved.author.name} · version {saved.version}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isEditor && (
              <Menu onAction={(v) => void setStatus(v as RequestStatus)}>
                <MenuTrigger className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted data-open:bg-muted">
                  Status <Chevron />
                </MenuTrigger>
                <AppMenuContent className="min-w-40">
                  {REQUEST_STATUSES.map((s) => (
                    <AppMenuItem key={s} value={s} disabled={s === saved.status || (Boolean(saved.skillId) && s !== 'approved')}>
                      {REQUEST_STATUS_LABEL[s]}
                    </AppMenuItem>
                  ))}
                </AppMenuContent>
              </Menu>
            )}
            {saved.skillId ? (
              <Link href={`/w/${workspace.slug}/skills/${saved.skillId}`}>
                <Button size="sm" variant="secondary">
                  Open skill: {saved.skillName}
                </Button>
              </Link>
            ) : (
              isEditor &&
              saved.status === 'approved' && (
                <Button size="sm" onClick={() => setConverting(true)}>
                  Turn into a skill
                </Button>
              )
            )}
            {(isEditor || saved.author.id === me.id) && (
              <Menu onAction={(v) => v === 'archive' && void archive()}>
                <MenuTrigger aria-label="More actions" className={iconButton}>
                  ⋯
                </MenuTrigger>
                <AppMenuContent className="min-w-40">
                  <AppMenuSeparator />
                  <AppMenuItem value="archive" className="text-danger">
                    Remove request
                  </AppMenuItem>
                </AppMenuContent>
              </Menu>
            )}
          </div>
        </div>
      </header>

      {conflict && (
        <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{conflict}</span>
          <Button size="sm" variant="secondary" onClick={reload}>
            Load latest
          </Button>
        </Alert>
      )}
      {!editable && (
        <Alert tone="info">
          {saved.status === 'approved' || saved.status === 'declined'
            ? `This request was ${REQUEST_STATUS_LABEL[saved.status].toLowerCase()}, so it is read-only.`
            : 'Only the author and editors can change this request. You can comment on it.'}
        </Alert>
      )}

      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={!editable} className="min-w-0 space-y-6">
          <Section n={1} title="The basics" help="What this work is, what sets it off, and what it delivers.">
            <TextField label="Workflow name" value={draft.name} onValueChange={(v: string) => update({ name: v })} error={errors.name} />
            <TextAreaField
              label="What starts it, and who starts it?"
              value={draft.trigger}
              onValueChange={(v: string) => update({ trigger: v })}
              placeholder="The AE hands over an awarded deal"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Owner"
                hint="The role accountable for it"
                value={draft.ownerRole}
                onValueChange={(v: string) => update({ ownerRole: v })}
              />
              <SelectField<Frequency | 'unset'>
                label="How often does it happen?"
                items={[{ value: 'unset', label: 'Not set' }, ...FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))]}
                value={draft.frequency ?? 'unset'}
                disabled={!editable}
                onValueChange={(v) => update({ frequency: v === 'unset' ? null : v })}
              />
            </div>
            <TextAreaField label="What is the result when it is done?" value={draft.result} onValueChange={(v: string) => update({ result: v })} />
          </Section>

          <Section n={2} title="The steps" help="In order, from start to finish. One step is one person doing one thing.">
            <ol className="space-y-4">
              {draft.steps.map((step, i) => (
                <li key={step.key} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                    <SelectField
                      className="min-w-0 flex-1 sm:max-w-64"
                      label={`Who does step ${i + 1}`}
                      hideLabel
                      items={actorItems}
                      value={step.actor || undefined}
                      disabled={!editable}
                      onValueChange={(actor) => updateStep(i, { actor })}
                      error={errors[`steps.${i}.roleId`]}
                    />
                    {editable && (
                      <span className="ml-auto flex">
                        <button type="button" className={iconButton} aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => update({ steps: move(draft.steps, i, i - 1) })}>↑</button>
                        <button type="button" className={iconButton} aria-label={`Move step ${i + 1} down`} disabled={i === draft.steps.length - 1} onClick={() => update({ steps: move(draft.steps, i, i + 1) })}>↓</button>
                        <button type="button" className={iconButton} aria-label={`Remove step ${i + 1}`} onClick={() => update({ steps: draft.steps.filter((_, j) => j !== i) })}>✕</button>
                      </span>
                    )}
                  </div>
                  {step.actor === OTHER_ROLE && (
                    <TextField label="Who, by job title" value={step.otherRole} placeholder="Sourcing officer" onValueChange={(v: string) => updateStep(i, { otherRole: v })} />
                  )}
                  <TextAreaField
                    label={`What happens in step ${i + 1}`}
                    hideLabel
                    value={step.action}
                    placeholder="Checks each PI for validity and quantity"
                    onValueChange={(v: string) => updateStep(i, { action: v })}
                    error={errors[`steps.${i}.action`]}
                  />
                  <TextField label="Where (optional)" value={step.place} placeholder="Email, Basecamp, a meeting…" onValueChange={(v: string) => updateStep(i, { place: v })} />
                  <CheckboxField label="Needs approval" checked={step.isApproval} disabled={!editable} onCheckedChange={(isApproval) => updateStep(i, { isApproval })} />
                  {step.isApproval && (
                    <TextField label="If the answer is no, then…" value={step.ifNo} onValueChange={(v: string) => updateStep(i, { ifNo: v })} />
                  )}
                </li>
              ))}
            </ol>
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => update({ steps: [...draft.steps, newRequestStep(draft.steps.at(-1))] })}>
                + Add a step
              </Button>
            )}
          </Section>

          <Section n={3} title="Information and documents needed" help="Everything someone has to provide along the way. Attach a blank form or an example if there is one.">
            <ul className="space-y-3">
              {draft.inputs.map((input, i) => (
                <li key={input.key} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <TextField className="min-w-48 flex-1" label="What" value={input.what} placeholder="Handover pack" onValueChange={(v: string) => update({ inputs: draft.inputs.map((x, j) => (j === i ? { ...x, what: v } : x)) })} error={errors[`inputs.${i}.what`]} />
                    <TextField className="w-44" label="Who provides it" value={input.who} placeholder="AE" onValueChange={(v: string) => update({ inputs: draft.inputs.map((x, j) => (j === i ? { ...x, who: v } : x)) })} />
                    {editable && (
                      <button type="button" className={`${iconButton} mt-6`} aria-label={`Remove item ${i + 1}`} onClick={() => update({ inputs: draft.inputs.filter((_, j) => j !== i) })}>✕</button>
                    )}
                  </div>
                  {input.id && fileList(input.id)}
                  {editable && input.id && (
                    <Button variant="ghost" size="sm" loading={uploading && uploadFor === input.id} onClick={() => pickFile(input.id)}>
                      Attach a file
                    </Button>
                  )}
                  {editable && !input.id && <p className="text-xs text-muted-foreground">Save to attach files to this item.</p>}
                </li>
              ))}
            </ul>
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => update({ inputs: [...draft.inputs, newRequestInput()] })}>
                + Add information
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Attachments: PDF, Word, Excel, PowerPoint, CSV, text or images, up to 10 MB each.</p>
          </Section>

          <Section n={4} title="Rules and time limits" help="What must always be followed, how long things may take, and what happens when something goes wrong.">
            <TextAreaField label="Rules and time limits" hideLabel rows={4} value={draft.rules} onValueChange={(v: string) => update({ rules: v })} />
          </Section>

          <Section n={5} title="Problems today" help="This is where we learn what to improve. Be candid.">
            <TextAreaField label="Where is time lost, or what often goes wrong?" rows={3} value={draft.problems} onValueChange={(v: string) => update({ problems: v })} />
            <TextAreaField label="What must always stay with a person?" hint="Decisions or steps that should never be automated" rows={3} value={draft.keepHuman} onValueChange={(v: string) => update({ keepHuman: v })} />
          </Section>
        </fieldset>

        <aside className="space-y-4 lg:sticky lg:top-6">
          {editable && (
            <Card className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm" role="status">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Button onClick={save} loading={saving} disabled={!dirty}>
                Save
              </Button>
            </Card>
          )}
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Files</h2>
            {saved.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <>
                {fileList(null)}
                {saved.inputs.map((input) =>
                  filesFor(input.id).length ? (
                    <div key={input.id} className="space-y-1">
                      <p className="text-xs text-muted-foreground">For: {input.what}</p>
                      {fileList(input.id)}
                    </div>
                  ) : null,
                )}
              </>
            )}
            {editable && (
              <Button variant="secondary" size="sm" loading={uploading && !uploadFor} onClick={() => pickFile(undefined)}>
                Attach a file
              </Button>
            )}
          </Card>
          <Card className="p-4">
            <CommentsPanel
              workspaceId={workspace.id}
              targetType="request"
              targetId={saved.id}
              steps={saved.steps.map((s, i) => ({ id: s.id, label: `step ${i + 1}: ${roleName(s.roleId, s.otherRole)}` }))}
              me={me}
              level={workspace.level}
            />
          </Card>
        </aside>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 shadow-lg lg:hidden">
          <span className="text-sm font-medium">Unsaved changes</span>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      )}

      {converting && (
        <AppDialog
          open
          onOpenChange={(open) => !open && setConverting(false)}
          title="Turn into a skill"
          description={`Creates a draft skill for ${agent.shortName} with these steps. People named under “someone else” become roles.`}
        >
          <div className="space-y-4">
            <SelectField
              label="Capability"
              items={agent.capabilities.map((c) => ({ value: c.id, label: c.name }))}
              value={capabilityId}
              onValueChange={setCapabilityId}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConverting(false)}>
                Cancel
              </Button>
              <Button disabled={!capabilityId} onClick={convert}>
                Create draft skill
              </Button>
            </div>
          </div>
        </AppDialog>
      )}
    </div>
  );
}
