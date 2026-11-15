'use client';

import { can, type AgentDetail, type Capability, type SkillDetail, type WorkspaceSummary } from '@skillflow/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppMenuContent, AppMenuItem, AppMenuSeparator, Chevron, Menu } from '@/components/ui/menu';
import { ask, notify } from '@/components/ui/overlays';
import { AppTab, AppTabPanel, AppTabsList, Tabs } from '@/components/ui/tabs';
import { MenuTrigger } from '@ui-sdk/react/menu';
import { AgentBadge } from '@/features/agents/agent-badge';
import { AgentFormDialog } from '@/features/agents/agent-form-dialog';
import { AgentSections } from '@/features/agents/agent-sections';
import { NameDialog } from '@/features/agents/name-dialog';
import { useAgent, useAgentCache } from '@/features/agents/queries';
import { CapabilityFlowView } from '@/features/flow/capability-flow';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { ReadinessMeter, StatusPill } from '@/features/skills/status-pill';
import { api, call } from '@/lib/api/client';

export default function AgentPage() {
  const { workspace: slug, agentId } = useParams<{ workspace: string; agentId: string }>();
  const { workspace } = useCurrentWorkspace(slug);
  if (!workspace) return null;
  return <AgentView workspace={workspace} agentId={agentId} />;
}

const moreButton =
  'grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary data-open:bg-muted';

function MoreIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  );
}

function AgentView({ workspace, agentId }: { workspace: WorkspaceSummary; agentId: string }) {
  const router = useRouter();
  const agent = useAgent(workspace.id, agentId);
  const cache = useAgentCache(workspace.id);
  const canEdit = can(workspace.level, 'content.edit');
  const [tab, setTab] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'flow'>('list');
  const [dialog, setDialog] = useState<null | 'edit' | 'add-capability' | 'rename-capability' | 'new-skill'>(null);

  if (agent.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (agent.isError) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Agent not found</h1>
        <p className="text-sm text-muted-foreground">It may have been archived.</p>
        <Link href={`/w/${workspace.slug}`} className="text-sm font-medium text-primary hover:underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }

  const data = agent.data;
  const selected = data.capabilities.find((c) => c.id === tab) ?? data.capabilities[0];
  const path = { workspaceId: workspace.id, agentId: data.id };

  async function archiveAgent() {
    const yes = await ask({
      title: `Archive ${data.fullName}?`,
      description: 'It leaves the sidebar. Its skills and their history are kept.',
      confirmLabel: 'Archive agent',
    });
    if (!yes) return;
    try {
      await call(api.DELETE('/api/w/{workspaceId}/agents/{agentId}', { params: { path } }));
      await cache.refreshAll();
      notify.success(`${data.fullName} archived`);
      router.replace(`/w/${workspace.slug}`);
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  async function capabilityAction(capability: Capability, action: string) {
    const index = data.capabilities.findIndex((c) => c.id === capability.id);
    try {
      if (action === 'rename') return setDialog('rename-capability');
      if (action === 'left' || action === 'right') {
        const ids = data.capabilities.map((c) => c.id);
        const to = action === 'left' ? index - 1 : index + 1;
        [ids[index], ids[to]] = [ids[to], ids[index]];
        cache.setAgent(
          await call<AgentDetail>(
            api.PUT('/api/w/{workspaceId}/agents/{agentId}/capabilities/order', { params: { path }, body: { ids } }),
          ),
        );
        return;
      }
      if (action === 'remove') {
        const yes = await ask({
          title: `Remove ${capability.name}?`,
          description:
            capability.skills.length > 0
              ? `Its ${capability.skills.length} skills are archived with it. Their history is kept.`
              : 'It has no skills.',
          confirmLabel: 'Remove capability',
        });
        if (!yes) return;
        cache.setAgent(
          await call<AgentDetail>(
            api.DELETE('/api/w/{workspaceId}/capabilities/{capabilityId}', {
              params: { path: { workspaceId: workspace.id, capabilityId: capability.id } },
            }),
          ),
        );
        setTab(null);
        notify.success(`${capability.name} removed`);
      }
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  async function moveSkill(capability: Capability, skillId: string, direction: -1 | 1) {
    const ids = capability.skills.map((s) => s.id);
    const from = ids.indexOf(skillId);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    try {
      cache.setAgent(
        await call<AgentDetail>(
          api.PUT('/api/w/{workspaceId}/capabilities/{capabilityId}/skills/order', {
            params: { path: { workspaceId: workspace.id, capabilityId: capability.id } },
            body: { ids },
          }),
        ),
      );
    } catch (e) {
      notify.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <AgentBadge shortName={data.shortName} color={data.color} className="mt-1.5 h-6 text-xs" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{data.fullName}</h1>
          {data.description ? (
            <p className="mt-1 text-muted-foreground">{data.description}</p>
          ) : (
            canEdit && <p className="mt-1 text-sm text-muted-foreground">Add a description so everyone knows what this agent is for.</p>
          )}
        </div>
        {canEdit && (
          <Menu
            onAction={(value) => {
              if (value === 'edit') setDialog('edit');
              if (value === 'archive') void archiveAgent();
            }}
          >
            <MenuTrigger aria-label={`More actions for ${data.fullName}`} className={moreButton}>
              <MoreIcon />
            </MenuTrigger>
            <AppMenuContent className="min-w-44">
              <AppMenuItem value="edit">Edit agent</AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem value="archive" className="text-danger">
                Archive agent
              </AppMenuItem>
            </AppMenuContent>
          </Menu>
        )}
      </header>

      <AgentSections slug={workspace.slug} agentId={data.id} current="skills" />

      <Tabs value={selected?.id ?? null} onValueChange={(value) => setTab(value as string | null)}>
        <div className="flex items-end gap-2">
          <AppTabsList aria-label="Capabilities" className="min-w-0 flex-1">
            {data.capabilities.map((c) => (
              <AppTab key={c.id} value={c.id}>
                {c.name}
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{c.skills.length}</span>
              </AppTab>
            ))}
          </AppTabsList>
          {canEdit && (
            <Button variant="ghost" size="sm" className="mb-1" onClick={() => setDialog('add-capability')}>
              + Capability
            </Button>
          )}
        </div>

        {data.capabilities.map((capability, index) => (
          <AppTabPanel key={capability.id} value={capability.id} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Show skills as" className="inline-flex rounded-lg border border-border p-0.5">
                {(['list', 'flow'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {m === 'list' ? 'List' : 'Full flow'}
                  </button>
                ))}
              </div>
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {capability.skills.length === 0
                  ? 'No skills yet.'
                  : `${capability.skills.length} ${capability.skills.length === 1 ? 'skill' : 'skills'}, in the order the work happens.`}
              </p>
              {canEdit && (
                <>
                  <Menu onAction={(value) => void capabilityAction(capability, String(value))}>
                    <MenuTrigger
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium hover:bg-muted data-open:bg-muted"
                      aria-label={`Capability actions for ${capability.name}`}
                    >
                      Capability <Chevron />
                    </MenuTrigger>
                    <AppMenuContent className="min-w-44">
                      <AppMenuItem value="rename">Rename</AppMenuItem>
                      <AppMenuItem value="left" disabled={index === 0}>
                        Move left
                      </AppMenuItem>
                      <AppMenuItem value="right" disabled={index === data.capabilities.length - 1}>
                        Move right
                      </AppMenuItem>
                      <AppMenuSeparator />
                      <AppMenuItem value="remove" disabled={data.capabilities.length <= 1} className="text-danger">
                        Remove
                      </AppMenuItem>
                    </AppMenuContent>
                  </Menu>
                  <Button size="sm" onClick={() => setDialog('new-skill')}>
                    + New skill
                  </Button>
                </>
              )}
            </div>

            {mode === 'flow' && capability.skills.length > 0 ? (
              <CapabilityFlowView
                workspaceId={workspace.id}
                workspaceSlug={workspace.slug}
                capabilityId={capability.id}
                agent={data}
              />
            ) : capability.skills.length === 0 ? (
              <Card className="px-5 py-8 text-center">
                <p className="font-medium">Describe the first piece of work {data.shortName} does here</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  A skill is one workflow: what starts it, each step and who does it, where a person approves, and what it delivers.
                </p>
                {canEdit && (
                  <Button className="mt-4" onClick={() => setDialog('new-skill')}>
                    Write the first skill
                  </Button>
                )}
              </Card>
            ) : (
              <Card>
                <ol className="divide-y divide-border">
                  {capability.skills.map((skill, i) => (
                    <li key={skill.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-5 text-right text-sm text-muted-foreground tabular-nums">
                        {skill.runsAlongside ? '↻' : i + 1}
                      </span>
                      <Link
                        href={`/w/${workspace.slug}/skills/${skill.id}`}
                        className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="block truncate font-medium hover:underline">{skill.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <StatusPill status={skill.status} />
                          <ReadinessMeter passed={skill.checksPassed} />
                          <span className="text-xs text-muted-foreground">
                            {skill.stepCount} {skill.stepCount === 1 ? 'step' : 'steps'}
                          </span>
                          {skill.runsAlongside && <span className="text-xs text-muted-foreground">Runs alongside every skill</span>}
                        </span>
                      </Link>
                      {canEdit && capability.skills.length > 1 && (
                        <span className="flex flex-col">
                          <button
                            type="button"
                            aria-label={`Move ${skill.name} up`}
                            disabled={i === 0}
                            onClick={() => moveSkill(capability, skill.id, -1)}
                            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none"><path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" /></svg>
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${skill.name} down`}
                            disabled={i === capability.skills.length - 1}
                            onClick={() => moveSkill(capability, skill.id, 1)}
                            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" /></svg>
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </AppTabPanel>
        ))}
      </Tabs>

      {dialog === 'edit' && (
        <AgentFormDialog
          workspaceId={workspace.id}
          agent={data}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSaved={(saved) => {
            cache.setAgent(saved);
            notify.success('Agent saved');
          }}
        />
      )}
      {dialog === 'add-capability' && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="New capability"
          description="A group of related skills, such as “KPI planning” or “Billing”."
          label="Name"
          placeholder="KPI planning"
          submitLabel="Add capability"
          onSubmit={async (name) => {
            const saved = await call<AgentDetail>(
              api.POST('/api/w/{workspaceId}/agents/{agentId}/capabilities', { params: { path }, body: { name } }),
            );
            cache.setAgent(saved);
            setTab(saved.capabilities.at(-1)?.id ?? null);
          }}
        />
      )}
      {dialog === 'rename-capability' && selected && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Rename capability"
          label="Name"
          initial={selected.name}
          submitLabel="Save"
          onSubmit={async (name) => {
            cache.setAgent(
              await call<AgentDetail>(
                api.PATCH('/api/w/{workspaceId}/capabilities/{capabilityId}', {
                  params: { path: { workspaceId: workspace.id, capabilityId: selected.id } },
                  body: { name },
                }),
              ),
            );
          }}
        />
      )}
      {dialog === 'new-skill' && selected && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`New skill in ${selected.name}`}
          description="Name the workflow. You will describe its steps next."
          label="Skill name"
          placeholder="Monthly KPI planning"
          submitLabel="Create and open"
          onSubmit={async (name) => {
            const skill = await call<SkillDetail>(
              api.POST('/api/w/{workspaceId}/skills', {
                params: { path: { workspaceId: workspace.id } },
                body: { capabilityId: selected.id, name },
              }),
            );
            await cache.refreshAll();
            router.push(`/w/${workspace.slug}/skills/${skill.id}`);
          }}
        />
      )}
    </div>
  );
}
