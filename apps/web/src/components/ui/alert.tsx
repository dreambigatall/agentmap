import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  error: 'border-danger/30 bg-danger/10 text-danger',
  success: 'border-success/30 bg-success/10 text-foreground',
  info: 'border-border bg-muted text-foreground',
  warning: 'border-warning/40 bg-warning/10 text-foreground',
} as const;

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2.5 text-sm', tones[tone], className)}
    >
      {children}
    </div>
  );
}
