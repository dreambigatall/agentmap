'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Can } from '@/features/auth/can';
import { useAgents } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';

export default function DashboardPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const { me, workspace } = useCurrentWorkspace(slug);
  const agents = useAgents(workspace?.id ?? '');
  if (!workspace || !me.data) return null;
  const firstAgent = agents.data?.[0];

  const steps = [
    { done: true, label: 'Create your workspace' },
    { done: me.data.emailVerified, label: 'Confirm your email address' },
    {
      done: false,
      label: 'Invite a teammate',
      href: `/w/${slug}/settings/members`,
      action: 'members.manage' as const,
    },
    {
      done: (firstAgent?.skillCount ?? 0) > 0,
      label: firstAgent ? `Describe ${firstAgent.fullName}’s first skill` : 'Add your first agent with + next to Agents',
      href: firstAgent ? `/w/${slug}/agents/${firstAgent.id}` : undefined,
      action: 'content.edit' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="mt-1 text-muted-foreground">
          Hi {me.data.name.split(' ')[0]}. Here is what to do next.
        </p>
      </div>
      <Card className="p-5">
        <h2 className="mb-4 font-semibold">First steps</h2>
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
                {step.href && step.action ? (
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
    </div>
  );
}
