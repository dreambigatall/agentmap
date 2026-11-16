'use client';

import { STATUS_LABEL, type NamedItem, type PublicAgent } from '@skillflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AppTab, AppTabPanel, AppTabsList, Tabs } from '@/components/ui/tabs';
import { AgentBadge } from '@/features/agents/agent-badge';
import { FlowDiagram } from '@/features/flow/flow-diagram';
import { toLayout } from '@/features/flow/to-layout';
import { StoryView } from '@/features/skills/story-view';
import { ApiError, api, call } from '@/lib/api/client';

/** A read-only view of one agent for people without an account. */
export default function SharedAgentPage() {
  const { token } = useParams<{ token: string }>();
  const shared = useQuery({
    queryKey: ['share', token],
    retry: false,
    queryFn: () => call<PublicAgent>(api.GET('/api/share/{token}', { params: { path: { token } } })),
  });

  if (shared.isPending) return <Frame><p className="text-muted-foreground">Loading…</p></Frame>;
  if (shared.isError) {
    const gone = shared.error instanceof ApiError && shared.error.status === 404;
    return (
      <Frame>
        <h1 className="text-xl font-semibold">{gone ? 'This link is not available' : 'Something went wrong'}</h1>
        <p className="mt-2 text-muted-foreground">
          {gone ? 'It may have been turned off. Ask the person who sent it for a new one.' : shared.error.message}
        </p>
      </Frame>
    );
  }
  return <Shared data={shared.data} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            S
          </span>
          <span className="font-semibold">Skillflow</span>
          <span className="ml-auto text-xs text-muted-foreground">Read-only shared view</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

function Shared({ data }: { data: PublicAgent }) {
  const roles: NamedItem[] = useMemo(() => data.roles.map((r) => ({ ...r, usedBy: 0 })), [data.roles]);
  const channels: NamedItem[] = useMemo(() => data.channels.map((c) => ({ ...c, usedBy: 0 })), [data.channels]);
  const [tab, setTab] = useState<string | null>(data.capabilities[0]?.id ?? null);
  const capability = data.capabilities.find((c) => c.id === tab) ?? data.capabilities[0];
  const [skillId, setSkillId] = useState<string | null>(null);
  const skill = capability?.skills.find((s) => s.id === skillId) ?? capability?.skills[0];

  const layout = useMemo(
    () => (capability ? toLayout(capability.skills, data.agent.shortName, roles) : null),
    [capability, data.agent.shortName, roles],
  );

  return (
    <Frame>
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <AgentBadge shortName={data.agent.shortName} color={data.agent.color} className="mt-1.5 h-6 text-xs" />
          <div>
            <p className="text-sm text-muted-foreground">{data.workspaceName}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{data.agent.fullName}</h1>
            {data.agent.description && <p className="mt-1 text-muted-foreground">{data.agent.description}</p>}
          </div>
        </header>

        {data.capabilities.length === 0 ? (
          <p className="text-muted-foreground">This agent has no skills yet.</p>
        ) : (
          <Tabs value={capability?.id ?? null} onValueChange={(v) => { setTab(v as string | null); setSkillId(null); }}>
            <AppTabsList aria-label="Capabilities">
              {data.capabilities.map((c) => (
                <AppTab key={c.id} value={c.id}>
                  {c.name}
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{c.skills.length}</span>
                </AppTab>
              ))}
            </AppTabsList>
            {data.capabilities.map((c) => (
              <AppTabPanel key={c.id} value={c.id} className="space-y-6 pt-4">
                {layout && c.skills.length > 0 && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-semibold">Full flow</h2>
                    <FlowDiagram layout={layout} agent={data.agent} label={`Full flow of ${c.name}`} />
                  </Card>
                )}
                {c.skills.length === 0 ? (
                  <p className="text-muted-foreground">No skills in {c.name} yet.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
                    <nav aria-label="Skills">
                      <ul className="space-y-1">
                        {c.skills.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              aria-current={s.id === skill?.id ? 'true' : undefined}
                              onClick={() => setSkillId(s.id)}
                              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted aria-[current]:bg-muted aria-[current]:font-medium"
                            >
                              {s.name}
                              <span className="block text-xs text-muted-foreground">{STATUS_LABEL[s.status]}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </nav>
                    {skill && (
                      <Card className="p-5">
                        <h2 className="mb-4 text-lg font-semibold">{skill.name}</h2>
                        <StoryView skill={skill} agent={data.agent} roles={roles} channels={channels} />
                      </Card>
                    )}
                  </div>
                )}
              </AppTabPanel>
            ))}
          </Tabs>
        )}
      </div>
    </Frame>
  );
}
