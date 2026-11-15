import { READINESS_TOTAL, skillReadiness, type ReadinessSubject } from '@skillflow/shared';
import { cn } from '@/lib/utils';

/** The six checks from the shared rules, live as the person types. */
export function ReadinessPanel({ skill }: { skill: ReadinessSubject }) {
  const checks = skillReadiness(skill);
  const passed = checks.filter((c) => c.ok).length;
  return (
    <section aria-labelledby="readiness-title" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="readiness-title" className="text-sm font-semibold">
          Readiness
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {passed} of {READINESS_TOTAL}
        </span>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', passed === READINESS_TOTAL ? 'bg-success' : 'bg-primary')}
          style={{ width: `${(passed / READINESS_TOTAL) * 100}%` }}
        />
      </div>
      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.key} className="flex gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px]',
                check.ok ? 'bg-success text-white' : 'border border-border',
              )}
            >
              {check.ok ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className={check.ok ? 'text-muted-foreground' : 'font-medium'}>{check.label}</span>
              <span className="sr-only">{check.ok ? ': done' : ': to do'}</span>
              {!check.ok && <span className="block text-xs text-muted-foreground">{check.fix}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
