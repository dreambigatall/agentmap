import { READINESS_TOTAL, STATUS_LABEL, type SkillStatus } from '@skillflow/shared';
import { cn } from '@/lib/utils';

const TONE: Record<SkillStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  defined: 'bg-primary/15 text-primary',
  in_build: 'bg-warning/20 text-foreground',
  live: 'bg-success/20 text-foreground',
};

export function StatusPill({ status, className }: { status: SkillStatus; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-xs font-medium', TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "4 of 6" with a small bar, for lists of skills. */
export function ReadinessMeter({ passed }: { passed: number }) {
  const full = passed === READINESS_TOTAL;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" title="Readiness checklist">
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full', full ? 'bg-success' : 'bg-primary')}
          style={{ width: `${(passed / READINESS_TOTAL) * 100}%` }}
        />
      </span>
      <span className="tabular-nums">
        {passed} of {READINESS_TOTAL}
        <span className="sr-only"> readiness checks done</span>
      </span>
    </span>
  );
}
