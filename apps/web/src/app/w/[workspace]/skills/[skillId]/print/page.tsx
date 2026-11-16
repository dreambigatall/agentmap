'use client';

import { STATUS_LABEL } from '@skillflow/shared';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAgent, useChannels, useRoles, useSkill } from '@/features/agents/queries';
import { useCurrentWorkspace } from '@/features/auth/use-me';
import { FlowDiagram } from '@/features/flow/flow-diagram';
import { toLayout } from '@/features/flow/to-layout';
import { StoryView } from '@/features/skills/story-view';

/** One skill laid out for paper. Opens the print dialog once everything has loaded. */
export default function PrintSkillPage() {
  const { workspace: slug, skillId } = useParams<{ workspace: string; skillId: string }>();
  const { workspace } = useCurrentWorkspace(slug);
  const workspaceId = workspace?.id ?? '';
  const skill = useSkill(workspaceId, skillId);
  const agent = useAgent(workspaceId, skill.data?.agentId ?? '');
  const roles = useRoles(workspaceId);
  const channels = useChannels(workspaceId);
  const ready = Boolean(skill.data && agent.data && roles.data && channels.data);

  const layout = useMemo(
    () =>
      skill.data && agent.data && roles.data
        ? toLayout([{ ...skill.data, runsAlongside: false }], agent.data.shortName, roles.data)
        : null,
    [skill.data, agent.data, roles.data],
  );

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (skill.isError) return <p className="text-danger">{skill.error.message}</p>;
  if (!ready || !skill.data || !agent.data || !roles.data || !channels.data || !workspace) {
    return <p className="text-muted-foreground">Preparing the page…</p>;
  }
  const s = skill.data;

  return (
    <article className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <div className="flex justify-end print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <header className="border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">
          {workspace.name} · {agent.data.shortName} {agent.data.fullName} · {s.capabilityName}
        </p>
        <h1 className="text-2xl font-semibold">{s.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {STATUS_LABEL[s.status]} · version {s.version} · printed {new Date().toLocaleDateString()}
        </p>
      </header>
      <StoryView skill={s} agent={agent.data} roles={roles.data} channels={channels.data} />
      {layout && (
        <section className="break-inside-avoid">
          <h2 className="mb-3 font-semibold">Swimlane</h2>
          <FlowDiagram layout={layout} agent={agent.data} label={`Swimlane for ${s.name}`} walkthrough={false} />
        </section>
      )}
    </article>
  );
}
