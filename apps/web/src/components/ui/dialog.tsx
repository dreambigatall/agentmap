'use client';

import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@ui-sdk/react/dialog';
import type { ReactNode } from 'react';

/**
 * A modal form over the page (ui-sdk Dialog): focus moves in, Tab stays inside,
 * Escape closes and focus returns to whatever opened it.
 */
export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogBackdrop className="fixed inset-0 z-[70] bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <DialogContent className="fixed top-1/2 left-1/2 z-[71] max-h-[calc(100vh-32px)] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
        <div className="mb-5 space-y-1 pr-8">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>}
        </div>
        <DialogClose
          aria-label="Close"
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
