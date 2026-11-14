'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Me } from '@skillflow/shared';
import { api, call } from '@/lib/api/client';

export const ME_KEY = ['me'] as const;

/** The signed-in person and their workspaces. Every signed-in screen reads this. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => call<Me>(api.GET('/api/auth/me')),
    retry: false,
  });
}

export function useSetMe() {
  const client = useQueryClient();
  return (me: Me) => client.setQueryData(ME_KEY, me);
}

/** Pages under /w/[workspace] use this to turn the address slug into the workspace. */
export function useCurrentWorkspace(slug: string) {
  const me = useMe();
  const workspace = me.data?.workspaces.find((w) => w.slug === slug);
  return { me, workspace };
}
