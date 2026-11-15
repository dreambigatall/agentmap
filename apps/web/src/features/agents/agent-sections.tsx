'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Switches between an agent's skills and the requests describing its work. */
export function AgentSections({
  slug,
  agentId,
  current,
  requestCount,
}: {
  slug: string;
  agentId: string;
  current: 'skills' | 'requests';
  requestCount?: number;
}) {
  const items = [
    { key: 'skills' as const, label: 'Skills', href: `/w/${slug}/agents/${agentId}` },
    {
      key: 'requests' as const,
      label: requestCount === undefined ? 'Requests' : `Requests (${requestCount})`,
      href: `/w/${slug}/agents/${agentId}/requests`,
    },
  ];
  return (
    <nav aria-label="Agent sections" className="flex gap-1 border-b border-border">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={current === item.key ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm',
            current === item.key
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
