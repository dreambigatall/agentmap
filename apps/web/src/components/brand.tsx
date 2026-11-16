import { cn } from '@/lib/utils';

export const BRAND_NAME = 'Agentmap';

/** The product mark: three connected steps, like a tiny agent map. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground', className)}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6.5 7.5 12 16.5M12 16.5l5.5-9" />
        <circle cx="6" cy="6.5" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="6.5" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="17.5" r="2.4" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
