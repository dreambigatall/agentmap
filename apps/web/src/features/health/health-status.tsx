'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { healthLabel } from './health-label';

const toneClass = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

export function HealthStatus() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/health');
      if (error || !data) throw new Error('Health check failed');
      return data;
    },
    refetchInterval: 30_000,
  });

  const label = healthLabel(query.data, query.isError);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
    >
      <span aria-hidden className={cn('size-2 rounded-full', toneClass[label.tone])} />
      {label.text}
    </span>
  );
}
