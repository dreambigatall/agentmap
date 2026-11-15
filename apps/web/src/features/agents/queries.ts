'use client';

import type { AgentDetail, AgentSummary, NamedItem, SkillDetail } from '@skillflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, call } from '@/lib/api/client';

export const keys = {
  agents: (ws: string) => ['agents', ws] as const,
  agent: (ws: string, id: string) => ['agent', ws, id] as const,
  roles: (ws: string) => ['roles', ws] as const,
  channels: (ws: string) => ['channels', ws] as const,
  skill: (ws: string, id: string) => ['skill', ws, id] as const,
};

export function useAgents(workspaceId: string) {
  return useQuery({
    queryKey: keys.agents(workspaceId),
    queryFn: () =>
      call<AgentSummary[]>(api.GET('/api/w/{workspaceId}/agents', { params: { path: { workspaceId } } })),
    enabled: Boolean(workspaceId),
  });
}

export function useAgent(workspaceId: string, agentId: string) {
  return useQuery({
    queryKey: keys.agent(workspaceId, agentId),
    queryFn: () =>
      call<AgentDetail>(
        api.GET('/api/w/{workspaceId}/agents/{agentId}', { params: { path: { workspaceId, agentId } } }),
      ),
    // The skill editor asks for its agent before it knows which one it is.
    enabled: Boolean(workspaceId && agentId),
  });
}

export function useRoles(workspaceId: string) {
  return useQuery({
    queryKey: keys.roles(workspaceId),
    queryFn: () => call<NamedItem[]>(api.GET('/api/w/{workspaceId}/roles', { params: { path: { workspaceId } } })),
  });
}

export function useChannels(workspaceId: string) {
  return useQuery({
    queryKey: keys.channels(workspaceId),
    queryFn: () =>
      call<NamedItem[]>(api.GET('/api/w/{workspaceId}/channels', { params: { path: { workspaceId } } })),
  });
}

export function useSkill(workspaceId: string, skillId: string) {
  return useQuery({
    queryKey: keys.skill(workspaceId, skillId),
    queryFn: () =>
      call<SkillDetail>(
        api.GET('/api/w/{workspaceId}/skills/{skillId}', { params: { path: { workspaceId, skillId } } }),
      ),
    // The editor owns the copy being edited; never swap it out from under the person.
    refetchOnWindowFocus: false,
  });
}

/** Puts a fresh agent into the cache and refreshes the sidebar counts. */
export function useAgentCache(workspaceId: string) {
  const client = useQueryClient();
  return {
    setAgent: (agent: AgentDetail) => {
      client.setQueryData(keys.agent(workspaceId, agent.id), agent);
      void client.invalidateQueries({ queryKey: keys.agents(workspaceId) });
    },
    refreshAll: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.agents(workspaceId) }),
        client.invalidateQueries({ queryKey: ['agent', workspaceId] }),
        client.invalidateQueries({ queryKey: ['flow', workspaceId] }),
      ]),
  };
}
