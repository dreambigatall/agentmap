'use client';

import {
  exportFileName,
  type Dashboard,
  type SearchResults,
  type ShareLink,
  type SkillExport,
} from '@skillflow/shared';
import { useQuery } from '@tanstack/react-query';
import { api, call } from '@/lib/api/client';

export const shareKeys = {
  links: (ws: string, agentId: string) => ['shares', ws, agentId] as const,
  dashboard: (ws: string) => ['dashboard', ws] as const,
  search: (ws: string, q: string) => ['search', ws, q] as const,
};

export function useShareLinks(workspaceId: string, agentId: string, enabled: boolean) {
  return useQuery({
    queryKey: shareKeys.links(workspaceId, agentId),
    enabled,
    queryFn: () =>
      call<ShareLink[]>(
        api.GET('/api/w/{workspaceId}/agents/{agentId}/shares', { params: { path: { workspaceId, agentId } } }),
      ),
  });
}

export function useDashboard(workspaceId: string) {
  return useQuery({
    queryKey: shareKeys.dashboard(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: () => call<Dashboard>(api.GET('/api/w/{workspaceId}/dashboard', { params: { path: { workspaceId } } })),
  });
}

export function useSearch(workspaceId: string, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: shareKeys.search(workspaceId, term),
    enabled: term.length >= 2,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    queryFn: () =>
      call<SearchResults>(
        api.GET('/api/w/{workspaceId}/search', { params: { path: { workspaceId }, query: { q: term } } }),
      ),
  });
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

/** Downloads a skill as a .agentmap.json file. */
export async function downloadSkill(workspaceId: string, skillId: string): Promise<void> {
  const file = await call<SkillExport>(
    api.GET('/api/w/{workspaceId}/skills/{skillId}/export', { params: { path: { workspaceId, skillId } } }),
  );
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(file.skill.name);
  link.click();
  URL.revokeObjectURL(url);
}
