'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/features/auth/use-me';

/** Opens the person's first workspace, or onboarding when they have none. */
export default function WorkspacesIndex() {
  const me = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!me.data) return;
    const first = me.data.workspaces[0];
    router.replace(first ? `/w/${first.slug}` : '/onboarding');
  }, [me.data, router]);

  return <p className="p-8 text-sm text-muted-foreground">Opening your workspace…</p>;
}
