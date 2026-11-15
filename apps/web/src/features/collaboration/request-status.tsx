import { REQUEST_STATUS_LABEL, type RequestStatus } from '@skillflow/shared';
import { cn } from '@/lib/utils';

const TONE: Record<RequestStatus, string> = {
  new: 'bg-primary/15 text-primary',
  in_review: 'bg-warning/20 text-foreground',
  approved: 'bg-success/20 text-foreground',
  declined: 'bg-muted text-muted-foreground',
};

export function RequestStatusPill({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-xs font-medium', TONE[status], className)}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}
