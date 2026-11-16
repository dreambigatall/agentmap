'use client';

import { TEMPLATES, templateSkillCount, type AgentDetail, type WorkspaceSummary } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { notify } from '@/components/ui/overlays';
import { AgentBadge } from '@/features/agents/agent-badge';
import { keys } from '@/features/agents/queries';
import { api, call } from '@/lib/api/client';

/** The five starter templates. Choosing one adds its agent and opens it. */
export function TemplatePicker({ workspace }: { workspace: WorkspaceSummary }) {
  const router = useRouter();
  const client = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  async function use(key: string) {
    setPending(key);
    try {
      const agent = await call<AgentDetail>(
        api.POST('/api/w/{workspaceId}/agents/from-template', {
          params: { path: { workspaceId: workspace.id } },
          body: { key },
        }),
      );
      await client.invalidateQueries({ queryKey: keys.agents(workspace.id) });
      notify.success(`${agent.fullName} added. Review its skills and make them yours.`);
      router.push(`/w/${workspace.slug}/agents/${agent.id}`);
    } catch (e) {
      notify.error((e as Error).message);
      setPending(null);
    }
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {TEMPLATES.map((template) => {
        const skills = templateSkillCount(template);
        return (
          <li key={template.key}>
            <Card className="flex h-full flex-col p-5">
              <div className="flex items-center gap-2">
                <AgentBadge shortName={template.agent.shortName} color={template.agent.color} />
                <h2 className="font-semibold">{template.name}</h2>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{template.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {template.capabilities.map((c) => c.name).join(' · ')} · {skills} skills
              </p>
              <Button
                className="mt-4 self-start"
                size="sm"
                variant="secondary"
                loading={pending === template.key}
                disabled={pending !== null}
                onClick={() => void use(template.key)}
              >
                Use this template
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
