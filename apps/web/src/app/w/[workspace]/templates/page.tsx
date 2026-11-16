'use client';

import { can } from '@skillflow/shared';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { TemplatePicker } from '@/features/templates/template-picker';

export default function TemplatesPage() {
  const { workspace: slug } = useParams<{ workspace: string }>();
  const welcome = useSearchParams().get('welcome') === '1';
  const { workspace } = useCurrentWorkspace(slug);
  if (!workspace) return null;

  if (!can(workspace.level, 'content.edit')) {
    return (
      <div className="mx-auto max-w-md space-y-2">
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="text-muted-foreground">Only editors can add agents. Ask an editor or admin of {workspace.name}.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        {welcome && <p className="text-sm font-medium text-primary">Your workspace is ready</p>}
        <h1 className="text-2xl font-semibold tracking-tight">Start from a template</h1>
        <p className="mt-1 text-muted-foreground">
          Each template adds an agent with worked-example skills: who does each step, where a person approves, and
          what it delivers. Every skill starts as a Draft for your team to adjust.
        </p>
      </div>
      <TemplatePicker workspace={workspace} />
      <p className="text-sm text-muted-foreground">
        Prefer a blank page?{' '}
        <Link href={`/w/${slug}`} className="font-medium text-primary hover:underline">
          Skip and add your own agent
        </Link>{' '}
        with + next to Agents.
      </p>
    </div>
  );
}
