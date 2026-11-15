'use client';

import {
  can,
  compareSteps,
  isSignedOff,
  INPUT_NEEDS,
  isReady,
  SKILL_STATUSES,
  STATUS_LABEL,
  statusChange,
  type AgentDetail,
  type InputNeed,
  type NamedItem,
  type SkillDetail,
  type SkillStatus,
  type StepChanges,
  type WorkspaceSummary,
} from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { MenuTrigger } from '@ui-sdk/react/menu';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { CheckboxField, SwitchField, TextAreaField } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/field';
import { AppMenuContent, AppMenuItem, AppMenuSeparator, Chevron, Menu } from '@/components/ui/menu';
import { ask, notify } from '@/components/ui/overlays';
import { AppTab, AppTabPanel, AppTabsList, Tabs } from '@/components/ui/tabs';
import { FlowDiagram, type NodeMark } from '@/features/flow/flow-diagram';
import { toLayout } from '@/features/flow/to-layout';
import { HistoryDialog } from '@/features/skills/history-dialog';
import { CommentsPanel } from '@/features/collaboration/comments-panel';
import { collabKeys, useSignoffs } from '@/features/collaboration/queries';
import { SignoffCard } from '@/features/collaboration/signoff-card';
import { AgentBadge } from '@/features/agents/agent-badge';
import { keys, useAgent, useAgentCache, useChannels, useRoles, useSkill } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import {
  AGENT_ACTOR,
  isDirty,
  move,
  newInput,
  newStep,
  toDraft,
  validateDraft,
  type Draft,
  type DraftStep,
} from '@/features/skills/editor-state';
import { ReadinessPanel } from '@/features/skills/readiness-panel';
import { StatusPill } from '@/features/skills/status-pill';
import { StoryView } from '@/features/skills/story-view';
import { ApiError, api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export default function SkillPage() {
  const { workspace: slug, skillId } = useParams<{ workspace: string; skillId: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);
  if (!workspace || !me.data) return null;
  return <SkillLoader workspace={workspace} skillId={skillId} me={{ id: me.data.id }} />;
}

function SkillLoader({ workspace, skillId, me }: { workspace: WorkspaceSummary; skillId: string; me: { id: string } }) {
  const skill = useSkill(workspace.id, skillId);
  const agentId = skill.data?.agentId ?? '';
  const agent = useAgent(workspace.id, agentId);
  const roles = useRoles(workspace.id);
  const channels = useChannels(workspace.id);

  if (skill.isError) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Skill not found</h1>
        <p className="text-sm text-muted-foreground">It may have been archived, or its agent was.</p>
        <Link href={`/w/${workspace.slug}`} className="text-sm font-medium text-primary hover:underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }
  if (!skill.data || !agent.data || !roles.data || !channels.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const props = { workspace, me, agent: agent.data, roles: roles.data, channels: channels.data };
  return can(workspace.level, 'content.edit') ? (
    <SkillEditor key={skill.data.id} initial={skill.data} {...props} />
  ) : (
    <SkillReadOnly skill={skill.data} {...props} />
  );
}

interface Context {
  workspace: WorkspaceSummary;
  me: { id: string };
  agent: AgentDetail;
  roles: NamedItem[];
  channels: NamedItem[];
}

function Header({
  workspace,
  agent,
  skill,
  name,
  actions,
}: Pick<Context, 'workspace' | 'agent'> & { skill: SkillDetail; name: string; actions?: ReactNode }) {
  const updated = new Date(skill.updatedAt).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <header className="space-y-2">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <AgentBadge shortName={agent.shortName} color={agent.color} />
        <Link href={`/w/${workspace.slug}/agents/${agent.id}`} className="hover:text-foreground hover:underline">
          {agent.fullName}
        </Link>
        <span aria-hidden>/</span>
        <span>{skill.capabilityName}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{name || 'Untitled skill'}</h1>
        <StatusPill status={skill.status} />
        <span className="text-xs text-muted-foreground">
          Version {skill.version} · {skill.updatedBy ? `${skill.updatedBy}, ` : ''}
          {updated}
        </span>
        <div className="ml-auto">{actions}</div>
      </div>
    </header>
  );
}

/** "Step 2: Approves the plans…", for choosing which step a comment is about. */
function stepChoices(skill: SkillDetail) {
  return skill.steps.map((step, i) => ({
    id: step.id,
    label: `step ${i + 1}: ${step.text.length > 40 ? `${step.text.slice(0, 40)}…` : step.text}`,
  }));
}

function SkillReadOnly({ skill, workspace, me, agent, roles, channels }: Context & { skill: SkillDetail }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const layout = useMemo(() => toLayout([{ ...skill, runsAlongside: false }], agent.shortName, roles), [skill, agent.shortName, roles]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header
        workspace={workspace}
        agent={agent}
        skill={skill}
        name={skill.name}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            History
          </Button>
        }
      />
      <Tabs defaultValue="story">
        <AppTabsList aria-label="Views of this skill">
          <AppTab value="story">Story</AppTab>
          <AppTab value="swimlane">Swimlane</AppTab>
          <AppTab value="comments">Comments</AppTab>
        </AppTabsList>
        <AppTabPanel value="story">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <Card className="p-5">
              <StoryView skill={skill} agent={agent} roles={roles} channels={channels} />
            </Card>
            <div className="space-y-4">
              <Card className="h-fit p-5">
                <SignoffCard workspaceId={workspace.id} level={workspace.level} me={me} skill={skill} />
              </Card>
              <Card className="h-fit p-5">
                <ReadinessPanel skill={skill} />
              </Card>
            </div>
          </div>
        </AppTabPanel>
        <AppTabPanel value="comments">
          <Card className="max-w-2xl p-5">
            <CommentsPanel
              workspaceId={workspace.id}
              targetType="skill"
              targetId={skill.id}
              steps={stepChoices(skill)}
              me={me}
              level={workspace.level}
            />
          </Card>
        </AppTabPanel>
        <AppTabPanel value="swimlane">
          <FlowDiagram layout={layout} agent={agent} label={`Swimlane for ${skill.name}`} />
        </AppTabPanel>
      </Tabs>
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspace.id}
        skillId={skill.id}
        currentVersion={skill.version}
        agent={agent}
        roles={roles}
        channels={channels}
      />
    </div>
  );
}

/** What the last save or restore changed, kept until the next edit. */
interface LastChange {
  version: number;
  previousVersion: number;
  changes: StepChanges;
  restoredFrom?: number;
}

function changeSummary(change: LastChange): string {
  const parts = [
    change.changes.added.size && `${change.changes.added.size} ${change.changes.added.size === 1 ? 'step' : 'steps'} added`,
    change.changes.changed.size && `${change.changes.changed.size} changed`,
    change.changes.removed.length && `${change.changes.removed.length} removed`,
  ].filter(Boolean);
  const head = change.restoredFrom
    ? `Restored version ${change.restoredFrom} as version ${change.version}`
    : `Saved version ${change.version}`;
  return parts.length ? `${head}: ${parts.join(', ')}.` : `${head}. The steps did not change.`;
}

function iconButton(extra?: string) {
  return cn(
    'grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
    'focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 disabled:hover:bg-transparent',
    extra,
  );
}

const ArrowUp = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const ArrowDown = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const Cross = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

function SkillEditor({ initial, workspace, me, agent, roles, channels }: Context & { initial: SkillDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const cache = useAgentCache(workspace.id);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const signoffs = useSignoffs(workspace.id, initial.id);
  const dirty = isDirty(draft, saved);

  // New and changed steps since the last save, while nothing else has been edited.
  const marks = useMemo(() => {
    if (!lastChange || dirty) return undefined;
    const map = new Map<string, NodeMark>();
    lastChange.changes.added.forEach((id) => map.set(id, 'new'));
    lastChange.changes.changed.forEach((id) => map.set(id, 'changed'));
    return map;
  }, [lastChange, dirty]);
  const nodeMarks = useMemo(
    () => (marks ? new Map([...marks].map(([id, mark]) => [`${saved.id}:${id}`, mark])) : undefined),
    [marks, saved.id],
  );
  const layout = useMemo(
    () => toLayout([{ ...draft, id: saved.id, runsAlongside: false }], agent.shortName, roles),
    [draft, saved.id, agent.shortName, roles],
  );
  const path = { workspaceId: workspace.id, skillId: saved.id };

  const actorItems = [
    { value: AGENT_ACTOR, label: `${agent.shortName} (the agent)` },
    ...roles.map((r) => ({ value: r.id, label: r.name })),
  ];

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }
  function updateStep(index: number, patch: Partial<DraftStep>) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));
  }

  const accept = useCallback(
    (next: SkillDetail) => {
      setSaved(next);
      setDraft(toDraft(next));
      client.setQueryData(keys.skill(workspace.id, next.id), next);
      void cache.refreshAll();
      void client.invalidateQueries({ queryKey: collabKeys.signoffs(workspace.id, next.id) });
    },
    [client, cache, workspace.id],
  );

  const save = useCallback(async () => {
    const { body, errors: problems } = validateDraft(draft, saved.version);
    setErrors(problems);
    if (!body) {
      notify.error('Some fields need attention', { description: Object.values(problems)[0] });
      return;
    }
    setSaving(true);
    try {
      const next = await call<SkillDetail>(api.PUT('/api/w/{workspaceId}/skills/{skillId}', { params: { path }, body }));
      const demoted = next.status !== saved.status;
      setLastChange({ version: next.version, previousVersion: saved.version, changes: compareSteps(saved.steps, next.steps) });
      accept(next);
      setConflict(null);
      notify.success(`Saved as version ${next.version}`, {
        description: demoted ? `Status is back to ${STATUS_LABEL[next.status]}: the checklist is no longer complete.` : undefined,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(error.message);
      else notify.error((error as Error).message);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved, accept]);

  // Ctrl+S / Cmd+S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  /** Restores an old version as a new one. Undo is a restore of the version before. */
  async function restoreVersion(number: number, mode: 'restore' | 'undo' = 'restore') {
    if (dirty) {
      const yes = await ask({
        title: 'Discard your unsaved changes?',
        description: `Restoring replaces what is in the editor with version ${number}.`,
        confirmLabel: 'Discard and restore',
      });
      if (!yes) return;
    } else if (mode === 'restore') {
      const yes = await ask({
        title: `Restore version ${number}?`,
        description: `It comes back as version ${saved.version + 1}. Version ${saved.version} stays in the history.`,
        confirmLabel: 'Restore',
      });
      if (!yes) return;
    }
    try {
      const before = saved;
      const next = await call<SkillDetail>(
        api.POST('/api/w/{workspaceId}/skills/{skillId}/restore', {
          params: { path },
          body: { number, expectedVersion: saved.version },
        }),
      );
      accept(next);
      setConflict(null);
      setErrors({});
      if (mode === 'undo') {
        setLastChange(null);
        notify.success(`Undone: back to the content of version ${number}`, {
          description: `Saved as version ${next.version}.`,
        });
      } else {
        setLastChange({
          version: next.version,
          previousVersion: before.version,
          changes: compareSteps(before.steps, next.steps),
          restoredFrom: number,
        });
        notify.success(`Restored version ${number}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(error.message);
      else notify.error((error as Error).message);
    }
  }

  async function reloadLatest() {
    if (dirty) {
      const yes = await ask({
        title: 'Load the latest version?',
        description: 'Your unsaved changes in this editor will be replaced by what was saved.',
        confirmLabel: 'Load latest',
      });
      if (!yes) return;
    }
    const latest = await call<SkillDetail>(api.GET('/api/w/{workspaceId}/skills/{skillId}', { params: { path } }));
    accept(latest);
    setConflict(null);
    setErrors({});
  }

  async function changeStatus(status: SkillStatus) {
    try {
      const next = await call<SkillDetail>(
        api.POST('/api/w/{workspaceId}/skills/{skillId}/status', { params: { path }, body: { status } }),
      );
      accept(next);
      notify.success(`Status: ${STATUS_LABEL[next.status]}`);
    } catch (error) {
      notify.error((error as Error).message);
    }
  }

  async function archive() {
    const yes = await ask({
      title: `Archive ${saved.name}?`,
      description: 'It leaves the agent’s list. Its versions are kept.',
      confirmLabel: 'Archive skill',
    });
    if (!yes) return;
    try {
      await call(api.DELETE('/api/w/{workspaceId}/skills/{skillId}', { params: { path } }));
      await cache.refreshAll();
      notify.success(`${saved.name} archived`);
      router.replace(`/w/${workspace.slug}/agents/${agent.id}`);
    } catch (error) {
      notify.error((error as Error).message);
    }
  }

  const savedReady = isReady(saved);
  const savedSignedOff = isSignedOff(signoffs.data ?? [], saved.version);

  return (
    <div className={cn('mx-auto max-w-6xl space-y-6', dirty && 'pb-20 lg:pb-0')}>
      <Header
        workspace={workspace}
        agent={agent}
        skill={saved}
        name={draft.name}
        actions={
          <Menu
            onAction={(value) => {
              if (value === 'history') setHistoryOpen(true);
              if (value === 'archive') void archive();
            }}
          >
            <MenuTrigger
              aria-label="More actions for this skill"
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted data-open:bg-muted"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
                <circle cx="3.5" cy="8" r="1.3" />
                <circle cx="8" cy="8" r="1.3" />
                <circle cx="12.5" cy="8" r="1.3" />
              </svg>
            </MenuTrigger>
            <AppMenuContent className="min-w-40">
              <AppMenuItem value="history">Version history</AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem value="archive" className="text-danger">
                Archive skill
              </AppMenuItem>
            </AppMenuContent>
          </Menu>
        }
      />

      {conflict && (
        <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-3">
          <span>{conflict}</span>
          <Button variant="secondary" size="sm" onClick={reloadLatest}>
            Load latest version
          </Button>
        </Alert>
      )}

      {lastChange && !dirty && (
        <Alert tone="success" className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {changeSummary(lastChange)}
            {lastChange.changes.removed.length > 0 && (
              <span className="block text-xs text-muted-foreground">
                Removed: {lastChange.changes.removed.map((s) => `“${s.text}”`).join(', ')}
              </span>
            )}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => restoreVersion(lastChange.previousVersion, 'undo')}>
              Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
            <Button variant="ghost" size="sm" aria-label="Dismiss" onClick={() => setLastChange(null)}>
              ✕
            </Button>
          </span>
        </Alert>
      )}

      <Tabs defaultValue="edit">
        <AppTabsList aria-label="Views of this skill">
          <AppTab value="edit">Edit</AppTab>
          <AppTab value="swimlane">Swimlane</AppTab>
          <AppTab value="comments">Comments</AppTab>
        </AppTabsList>
        <AppTabPanel value="comments">
          <Card className="max-w-2xl p-5">
            <CommentsPanel
              workspaceId={workspace.id}
              targetType="skill"
              targetId={saved.id}
              steps={stepChoices(saved)}
              me={me}
              level={workspace.level}
            />
          </Card>
        </AppTabPanel>
        <AppTabPanel value="swimlane" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            One row per actor. It follows your edits as you type{dirty ? ', including unsaved ones' : ''}.
          </p>
          <FlowDiagram layout={layout} agent={agent} label={`Swimlane for ${draft.name}`} marks={nodeMarks} />
        </AppTabPanel>
        <AppTabPanel value="edit">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Basics" />
            <div className="space-y-4 px-5 py-4">
              <TextField
                label="Skill name"
                value={draft.name}
                onValueChange={(value: string) => update({ name: value })}
                error={errors.name}
                maxLength={120}
              />
              <SelectField
                label="Capability"
                items={agent.capabilities.map((c) => ({ value: c.id, label: c.name }))}
                value={draft.capabilityId}
                onValueChange={(capabilityId) => update({ capabilityId })}
              />
              <SwitchField
                label="Runs alongside every skill"
                description="For rules that apply to all the work in this capability, such as approval checkpoints."
                checked={draft.runsAlongside}
                onCheckedChange={(runsAlongside) => update({ runsAlongside })}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="What starts it" description="Who or what sets this skill off." />
            <div className="space-y-4 px-5 py-4">
              <SelectField
                label="Started by"
                items={actorItems}
                value={draft.startedByRoleId ?? AGENT_ACTOR}
                onValueChange={(value) => update({ startedByRoleId: value === AGENT_ACTOR ? null : value })}
              />
              <TextAreaField
                label="Trigger"
                value={draft.trigger}
                onValueChange={(value: string) => update({ trigger: value })}
                placeholder="At the start of each month"
                error={errors.trigger}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Steps"
              description="In order. One step is one actor doing one thing. Mark the steps where a person decides."
            />
            <ol className="divide-y divide-border">
              {draft.steps.map((step, index) => (
                <li key={step.key} className="space-y-3 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <SelectField
                      className="min-w-0 flex-1 sm:max-w-60"
                      label={`Who does step ${index + 1}`}
                      hideLabel
                      items={actorItems}
                      value={step.roleId ?? AGENT_ACTOR}
                      onValueChange={(value) => updateStep(index, { roleId: value === AGENT_ACTOR ? null : value })}
                    />
                    <span className="ml-auto flex">
                      <button
                        type="button"
                        className={iconButton()}
                        aria-label={`Move step ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => update({ steps: move(draft.steps, index, index - 1) })}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        className={iconButton()}
                        aria-label={`Move step ${index + 1} down`}
                        disabled={index === draft.steps.length - 1}
                        onClick={() => update({ steps: move(draft.steps, index, index + 1) })}
                      >
                        <ArrowDown />
                      </button>
                      <button
                        type="button"
                        className={iconButton('hover:text-danger')}
                        aria-label={`Remove step ${index + 1}`}
                        onClick={() => update({ steps: draft.steps.filter((_, i) => i !== index) })}
                      >
                        <Cross />
                      </button>
                    </span>
                  </div>
                  <TextAreaField
                    label={`What happens in step ${index + 1}`}
                    hideLabel
                    value={step.text}
                    onValueChange={(value: string) => updateStep(index, { text: value })}
                    placeholder={step.roleId === null ? 'Drafts each person’s plan from the template' : 'Approves the plans, or sends one back'}
                    error={errors[`steps.${index}.text`]}
                  />
                  <CheckboxField
                    label="A person decides here (approval)"
                    description={
                      step.isApproval && step.roleId === null
                        ? 'An approval must be done by a person. Choose who above.'
                        : undefined
                    }
                    checked={step.isApproval}
                    onCheckedChange={(isApproval) => updateStep(index, { isApproval })}
                  />
                  {step.isApproval && (
                    <TextField
                      label="If the answer is no"
                      value={step.ifNo}
                      onValueChange={(value: string) => updateStep(index, { ifNo: value })}
                      placeholder="Sends it back with changes"
                      error={errors[`steps.${index}.ifNo`]}
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="border-t border-border px-5 py-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={draft.steps.length >= 60}
                onClick={() => update({ steps: [...draft.steps, newStep(draft.steps.at(-1))] })}
              >
                + Add step
              </Button>
              {errors.steps && <p className="mt-2 text-xs text-danger">{errors.steps}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Information it needs" description="What the skill uses: fetched by the agent, or asked of a person." />
            <ul className="divide-y divide-border">
              {draft.inputs.map((input, index) => (
                <li key={input.key} className="flex flex-wrap items-start gap-2 px-5 py-3">
                  <TextField
                    className="min-w-48 flex-1"
                    label={`Information ${index + 1}`}
                    hideLabel
                    value={input.label}
                    placeholder="KPI template and targets"
                    onValueChange={(value: string) =>
                      update({ inputs: draft.inputs.map((x, i) => (i === index ? { ...x, label: value } : x)) })
                    }
                    error={errors[`inputs.${index}.label`]}
                  />
                  <SelectField<InputNeed>
                    className="w-44"
                    label={`How information ${index + 1} is found`}
                    hideLabel
                    items={INPUT_NEEDS.map((need) => ({
                      value: need,
                      label: need === 'automatic' ? 'Agent fetches it' : 'A person provides it',
                    }))}
                    value={input.need}
                    onValueChange={(need) =>
                      update({ inputs: draft.inputs.map((x, i) => (i === index ? { ...x, need } : x)) })
                    }
                  />
                  <button
                    type="button"
                    className={iconButton('mt-0.5 hover:text-danger')}
                    aria-label={`Remove information ${index + 1}`}
                    onClick={() => update({ inputs: draft.inputs.filter((_, i) => i !== index) })}
                  >
                    <Cross />
                  </button>
                </li>
              ))}
            </ul>
            <div className={cn('px-5 py-3', draft.inputs.length > 0 && 'border-t border-border')}>
              <Button variant="secondary" size="sm" onClick={() => update({ inputs: [...draft.inputs, newInput()] })}>
                + Add information
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Where it talks to people"
              description="Pick each channel the agent uses in this skill, and say what for."
            />
            <ul className="divide-y divide-border">
              {channels.map((channel) => {
                const chosen = draft.channels.find((c) => c.channelId === channel.id);
                return (
                  <li key={channel.id} className="space-y-2 px-5 py-3">
                    <CheckboxField
                      label={channel.name}
                      checked={Boolean(chosen)}
                      onCheckedChange={(on) =>
                        update({
                          channels: on
                            ? [...draft.channels, { channelId: channel.id, usage: '' }]
                            : draft.channels.filter((c) => c.channelId !== channel.id),
                        })
                      }
                    />
                    {chosen && (
                      <TextField
                        label={`How it uses ${channel.name}`}
                        hideLabel
                        value={chosen.usage}
                        placeholder="Sends the drafts to each manager to approve"
                        onValueChange={(usage: string) =>
                          update({
                            channels: draft.channels.map((c) => (c.channelId === channel.id ? { ...c, usage } : c)),
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Result and human control" />
            <div className="space-y-4 px-5 py-4">
              <TextAreaField
                label="What it delivers"
                value={draft.deliverable}
                onValueChange={(value: string) => update({ deliverable: value })}
                placeholder="Approved monthly KPI plans for everyone, saved in the HR system"
                error={errors.deliverable}
              />
              <TextAreaField
                label="What always stays with a person"
                value={draft.humanControl}
                onValueChange={(value: string) => update({ humanControl: value })}
                placeholder="The line manager approves every plan. Targets come from approved templates, never from the agent."
                error={errors.humanControl}
              />
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className={cn('text-sm', dirty ? 'font-medium' : 'text-muted-foreground')} role="status">
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <Button onClick={save} loading={saving} disabled={!dirty && !saving}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ctrl+S also saves. Every save keeps a version.{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setHistoryOpen(true)}>
                See history
              </button>
            </p>
            <div className="border-t border-border pt-3">
              <Menu onAction={(value) => void changeStatus(value as SkillStatus)}>
                <MenuTrigger
                  disabled={dirty}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-60 data-open:bg-muted"
                >
                  <span>
                    Status: <StatusPill status={saved.status} className="ml-1" />
                  </span>
                  <Chevron />
                </MenuTrigger>
                <AppMenuContent className="w-72">
                  {SKILL_STATUSES.map((status) => {
                    const verdict = statusChange(status, { ready: savedReady, signedOff: savedSignedOff });
                    return (
                      <AppMenuItem
                        key={status}
                        value={status}
                        disabled={!verdict.allowed || status === saved.status}
                        className="flex-col items-start gap-0.5"
                      >
                        <span className="font-medium">
                          {STATUS_LABEL[status]}
                          {status === saved.status && ' (current)'}
                        </span>
                        {!verdict.allowed && <span className="text-xs text-muted-foreground">{verdict.reason}</span>}
                      </AppMenuItem>
                    );
                  })}
                  <AppMenuSeparator />
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Defined needs the full checklist. In build and Live need a business owner’s sign-off.
                  </p>
                </AppMenuContent>
              </Menu>
              {dirty && <p className="mt-1.5 text-xs text-muted-foreground">Save your changes before changing status.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <SignoffCard workspaceId={workspace.id} level={workspace.level} me={me} skill={saved} dirty={dirty} />
          </Card>

          <Card className="p-4">
            <ReadinessPanel skill={draft} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Preview</h2>
            <StoryView skill={draft} agent={agent} roles={roles} channels={channels} marks={marks} />
          </Card>
        </aside>
      </div>
        </AppTabPanel>
      </Tabs>

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspace.id}
        skillId={saved.id}
        currentVersion={saved.version}
        agent={agent}
        roles={roles}
        channels={channels}
        onRestore={(number) => restoreVersion(number)}
      />

      {/* On phones the side panel sits below the whole form, so keep Save in reach. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 shadow-lg lg:hidden">
          <span className="text-sm font-medium">Unsaved changes</span>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
