'use client';

import { can, type WorkspaceSummary } from '@skillflow/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { notify } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { AgentBadge } from './agent-badge';
import { AgentFormDialog } from './agent-form-dialog';
import { useAgentCache, useAgents } from './queries';

/** The sidebar's list of agents, with their skill counts and a way to add one. */
export function AgentsNav({ workspace, onNavigate }: { workspace: WorkspaceSummary; onNavigate?: () => void }) {
  const agents = useAgents(workspace.id);
  const pathname = usePathname();
  const router = useRouter();
  const cache = useAgentCache(workspace.id);
  const [creating, setCreating] = useState(false);
  const canEdit = can(workspace.level, 'content.edit');

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Agents</p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="New agent"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
      </div>

      {agents.isPending && <p className="px-2 py-1.5 text-muted-foreground">Loading…</p>}
      {agents.data?.length === 0 && (
        <p className="px-2 py-1.5 text-muted-foreground">
          No agents yet.
          {canEdit && (
            <>
              {' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setCreating(true)}>
                Add one
              </button>
            </>
          )}
        </p>
      )}
      <ul className="space-y-0.5">
        {agents.data?.map((agent) => {
          const href = `/w/${workspace.slug}/agents/${agent.id}`;
          const active = pathname.startsWith(href);
          return (
            <li key={agent.id}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5',
                  active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <AgentBadge shortName={agent.shortName} color={agent.color} />
                <span className="min-w-0 flex-1 truncate">{agent.fullName}</span>
                <span className="text-xs text-muted-foreground tabular-nums" aria-label={`${agent.skillCount} skills`}>
                  {agent.skillCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {creating && (
        <AgentFormDialog
          workspaceId={workspace.id}
          open={creating}
          onOpenChange={setCreating}
          onSaved={(agent) => {
            cache.setAgent(agent);
            notify.success(`${agent.fullName} created`);
            router.push(`/w/${workspace.slug}/agents/${agent.id}`);
          }}
        />
      )}
    </div>
  );
}
