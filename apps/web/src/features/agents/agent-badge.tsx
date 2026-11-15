import type { AgentColor } from '@skillflow/shared';
import { cn } from '@/lib/utils';

/** Literal class names, so Tailwind can see every colour it needs to generate. */
const COLOR_CLASS: Record<AgentColor, { badge: string; dot: string }> = {
  indigo: { badge: 'bg-agent-indigo/15 text-agent-indigo', dot: 'bg-agent-indigo' },
  teal: { badge: 'bg-agent-teal/15 text-agent-teal', dot: 'bg-agent-teal' },
  fuchsia: { badge: 'bg-agent-fuchsia/15 text-agent-fuchsia', dot: 'bg-agent-fuchsia' },
  amber: { badge: 'bg-agent-amber/15 text-agent-amber', dot: 'bg-agent-amber' },
  emerald: { badge: 'bg-agent-emerald/15 text-agent-emerald', dot: 'bg-agent-emerald' },
  rose: { badge: 'bg-agent-rose/15 text-agent-rose', dot: 'bg-agent-rose' },
  sky: { badge: 'bg-agent-sky/15 text-agent-sky', dot: 'bg-agent-sky' },
  violet: { badge: 'bg-agent-violet/15 text-agent-violet', dot: 'bg-agent-violet' },
};

export function AgentBadge({
  shortName,
  color,
  className,
}: {
  shortName: string;
  color: AgentColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] font-semibold tracking-wide',
        COLOR_CLASS[color].badge,
        className,
      )}
    >
      {shortName}
    </span>
  );
}

export function AgentDot({ color, className }: { color: AgentColor; className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full', COLOR_CLASS[color].dot, className)} />;
}
