'use client';

import type { RequestDetail, WorkspaceSummary } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AgentBadge } from '@/features/agents/agent-badge';
import { AgentSections } from '@/features/agents/agent-sections';
import { NameDialog } from '@/features/agents/name-dialog';
import { useAgent } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { useRequests } from '@/features/collaboration/queries';
import { RequestStatusPill } from '@/features/collaboration/request-status';
import { api, call } from '@/lib/api/client';

export default function AgentRequestsPage() {
  const { workspace: slug, agentId } = useParams<{ workspace: string; agentId: string }>();
  const { workspace } = useCurrentWorkspace(slug);
  if (!workspace) return null;
  return <Requests workspace={workspace} agentId={agentId} />;
}

function Requests({ workspace, agentId }: { workspace: WorkspaceSummary; agentId: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const agent = useAgent(workspace.id, agentId);
  const requests = useRequests(workspace.id, agentId);
  const [creating, setCreating] = useState(false);

  if (!agent.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const data = agent.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <AgentBadge shortName={data.shortName} color={data.color} className="mt-1.5 h-6 text-xs" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{data.fullName}</h1>
          <p className="mt-1 text-muted-foreground">
            Requests describe how work is done today, in the words of the people who do it. Editors review them and turn
            approved ones into skills.
          </p>
        </div>
      </header>
      <AgentSections slug={workspace.slug} agentId={agentId} current="requests" requestCount={requests.data?.length} />

      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>+ New request</Button>
      </div>

      {requests.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {requests.data?.length === 0 && (
        <Card className="px-5 py-8 text-center">
          <p className="font-medium">No requests yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ask the people who do the work today to describe it: what starts it, each step, who approves, and what goes
            wrong. Anyone in the workspace can write one.
          </p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            Describe a workflow
          </Button>
        </Card>
      )}
      {requests.data && requests.data.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {requests.data.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/w/${workspace.slug}/requests/${r.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.author.name} · {new Date(r.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      {' · '}
                      {r.stepCount} {r.stepCount === 1 ? 'step' : 'steps'}
                    </span>
                  </span>
                  {r.skillId && <span className="text-xs text-success">Became a skill</span>}
                  <RequestStatusPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {creating && (
        <NameDialog
          open
          onOpenChange={setCreating}
          title={`New request for ${data.shortName}`}
          description="Name the workflow as people call it today. You will describe it step by step next."
          label="Workflow name"
          placeholder="Pre-contract analysis"
          submitLabel="Create and open"
          onSubmit={async (name) => {
            const created = await call<RequestDetail>(
              api.POST('/api/w/{workspaceId}/requests', {
                params: { path: { workspaceId: workspace.id } },
                body: { agentId, name },
              }),
            );
            await client.invalidateQueries({ queryKey: ['requests', workspace.id] });
            router.push(`/w/${workspace.slug}/requests/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
