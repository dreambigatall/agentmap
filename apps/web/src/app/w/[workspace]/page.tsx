'use client';

import { REQUEST_STATUS_LABEL, STATUS_LABEL, SKILL_STATUSES, type AgentSummary, type Dashboard } from '@skillflow/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Can } from '@/features/auth/can';
import { AgentBadge } from '@/features/agents/agent-badge';
import { useAgents } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { useDashboard } from '@/features/sharing/queries';

function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Card>
  );
}

function Row({ href, agent, title, detail }: { href: string; agent?: AgentSummary; title: string; detail: string }) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted">
        {agent && <AgentBadge shortName={agent.shortName} color={agent.color} />}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);
  const agents = useAgents(workspace?.id ?? '');
  const board = useDashboard(workspace?.id ?? '');
  if (!workspace || !me.data) return null;

  const agentById = new Map((agents.data ?? []).map((a) => [a.id, a]));
  const firstAgent = agents.data?.[0];
  const setup = board.data?.setup;
  const steps = setup
    ? [
        { done: me.data.emailVerified, label: 'Confirm your email address' },
        {
          done: setup.hasAgent,
          label: 'Add your first agent, or start from a template',
          href: `/w/${slug}/templates`,
          action: 'content.edit' as const,
        },
        {
          done: setup.hasSkill,
          label: firstAgent ? `Describe ${firstAgent.fullName}’s first skill` : 'Describe your first skill',
          href: firstAgent ? `/w/${slug}/agents/${firstAgent.id}` : undefined,
          action: 'content.edit' as const,
        },
        {
          done: setup.hasTeammate,
          label: 'Invite a teammate to review',
          href: `/w/${slug}/settings/members`,
          action: 'members.manage' as const,
        },
        {
          done: setup.hasSignoff,
          label: 'Ask a business owner to sign off a skill',
          href: firstAgent ? `/w/${slug}/agents/${firstAgent.id}` : undefined,
          action: 'content.edit' as const,
        },
        {
          done: setup.hasShare,
          label: 'Share an agent with a read-only link',
          href: firstAgent ? `/w/${slug}/agents/${firstAgent.id}` : undefined,
          action: 'content.edit' as const,
        },
      ]
    : [];
  const doneCount = steps.filter((s) => s.done).length;
  const showSteps = steps.length > 0 && doneCount < steps.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="mt-1 text-muted-foreground">Hi {me.data.name.split(' ')[0]}. Here is what needs you.</p>
      </div>

      {showSteps && (
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Set up your workspace</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneCount} of {steps.length} done
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
            className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-success" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={
                    step.done
                      ? 'grid size-5 place-items-center rounded-full bg-success text-[11px] text-white'
                      : 'size-5 rounded-full border-2 border-border'
                  }
                >
                  {step.done ? '✓' : ''}
                </span>
                <span className={step.done ? 'text-muted-foreground line-through' : ''}>
                  {!step.done && step.href && step.action ? (
                    <Can level={workspace.level} action={step.action} fallback={step.label}>
                      <Link href={step.href} className="font-medium text-primary hover:underline">
                        {step.label}
                      </Link>
                    </Can>
                  ) : (
                    step.label
                  )}
                </span>
                <span className="sr-only">{step.done ? '(done)' : '(to do)'}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {board.isError && <p className="text-sm text-danger">{board.error.message}</p>}
      {board.data && <Board data={board.data} slug={slug} agentById={agentById} />}
    </div>
  );
}

function Board({ data, slug, agentById }: { data: Dashboard; slug: string; agentById: Map<string, AgentSummary> }) {
  const total = SKILL_STATUSES.reduce((sum, s) => sum + data.counts[s], 0);
  return (
    <>
      <section aria-label="Skills by status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SKILL_STATUSES.map((status) => (
          <Card key={status} className="p-4">
            <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data.counts[status]}</p>
          </Card>
        ))}
      </section>
      {total === 0 && <p className="text-sm text-muted-foreground">No skills yet. Open an agent to describe its first one.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Waiting for your sign-off" empty="Nothing to sign off.">
          {data.waitingOnMe.map((s) => (
            <Row
              key={s.id}
              href={`/w/${slug}/skills/${s.skillId}`}
              agent={agentById.get(s.agentId)}
              title={s.skillName}
              detail={`${s.askedBy} · ${when(s.askedAt)}`}
            />
          ))}
        </Section>
        {data.toReview.length > 0 || data.myRequests.length === 0 ? (
          <Section title="Requests to review" empty="No new requests.">
            {data.toReview.map((r) => (
              <Row
                key={r.id}
                href={`/w/${slug}/requests/${r.id}`}
                agent={agentById.get(r.agentId)}
                title={r.name}
                detail={`${REQUEST_STATUS_LABEL[r.status]} · ${r.author}`}
              />
            ))}
          </Section>
        ) : null}
        {data.myRequests.length > 0 && (
          <Section title="Your open requests" empty="">
            {data.myRequests.map((r) => (
              <Row
                key={r.id}
                href={`/w/${slug}/requests/${r.id}`}
                agent={agentById.get(r.agentId)}
                title={r.name}
                detail={`${REQUEST_STATUS_LABEL[r.status]} · ${when(r.updatedAt)}`}
              />
            ))}
          </Section>
        )}
      </div>

      <Section title="Recent changes" empty="Nothing has changed yet.">
        {data.recent.map((item) => (
          <Row
            key={`${item.kind}-${item.id}-${item.at}`}
            href={`/w/${slug}/${item.kind === 'skill' ? 'skills' : 'requests'}/${item.id}`}
            agent={agentById.get(item.agentId)}
            title={`${item.title}: ${item.note}`}
            detail={`${item.author ?? 'Someone'} · ${when(item.at)}`}
          />
        ))}
      </Section>
    </>
  );
}
