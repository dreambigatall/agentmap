'use client';

import type { AgentColor, CapabilityFlow } from '@skillflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useRoles } from '@/features/agents/queries';
import { api, call } from '@/lib/api/client';
import { FlowDiagram } from './flow-diagram';
import { toLayout } from './to-layout';

/**
 * Every skill of one capability in one swimlane, start to finish. Only the first skill
 * needs a person to start it; dashed arrows show where the agent starts the next itself.
 */
export function CapabilityFlowView({
  workspaceId,
  workspaceSlug,
  capabilityId,
  agent,
}: {
  workspaceId: string;
  workspaceSlug: string;
  capabilityId: string;
  agent: { shortName: string; color: AgentColor };
}) {
  const roles = useRoles(workspaceId);
  const flow = useQuery({
    queryKey: ['flow', workspaceId, capabilityId],
    queryFn: () =>
      call<CapabilityFlow>(
        api.GET('/api/w/{workspaceId}/capabilities/{capabilityId}/flow', {
          params: { path: { workspaceId, capabilityId } },
        }),
      ),
  });

  const layout = useMemo(
    () => (flow.data && roles.data ? toLayout(flow.data.skills, agent.shortName, roles.data) : null),
    [flow.data, roles.data, agent.shortName],
  );

  if (flow.isError) return <p className="text-sm text-danger">{flow.error.message}</p>;
  if (!layout || !flow.data) return <p className="text-sm text-muted-foreground">Drawing the flow…</p>;

  const chain = flow.data.skills.filter((s) => !s.runsAlongside).length;
  const steps = layout.nodes.filter((n) => n.kind === 'step').length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {flow.data.capabilityName} from start to finish: {chain} {chain === 1 ? 'skill' : 'skills'}, {steps}{' '}
        {steps === 1 ? 'step' : 'steps'}. Dashed arrows: the agent starts the next skill by itself. Select a skill name to
        open it.
      </p>
      <FlowDiagram
        layout={layout}
        agent={agent}
        label={`Full flow of ${flow.data.capabilityName}`}
        hrefForSkill={(skillId) => `/w/${workspaceSlug}/skills/${skillId}`}
      />
    </div>
  );
}
