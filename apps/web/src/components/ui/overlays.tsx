'use client';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  createConfirm,
  type ConfirmOptions,
} from '@ui-sdk/react/alert-dialog';
import { OverlayHost, createOverlays } from '@ui-sdk/react/overlays';
import { Toast, ToastClose, ToastDescription, ToastTitle, createToaster } from '@ui-sdk/react/toast';

/**
 * One place for app-wide confirmations and notifications.
 * Call `ask()` instead of window.confirm and `notify` instead of inline success banners.
 * <AppOverlays /> is mounted once in the root providers and renders both.
 */
const overlays = createOverlays();
export const notify = createToaster({ overlays });
export const ask = createConfirm({ overlays });

const buttonBase =
  'inline-flex h-8 items-center justify-center rounded-md px-3 text-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function AppOverlays() {
  return (
    <>
      <OverlayHost
        overlays={overlays}
        toast={{
          className: 'fixed right-4 bottom-4 z-[60] w-[min(356px,calc(100vw-32px))]',
          children: () => (
            <Toast className="flex items-start gap-3 rounded-md border border-border-strong bg-card p-4 pr-10 text-sm shadow-xl shadow-black/40 data-[type=error]:border-danger/40 data-[type=success]:border-success/40">
              <span
                aria-hidden
                className="mt-1 size-2 shrink-0 rounded-full bg-primary in-data-[type=error]:bg-danger in-data-[type=success]:bg-success"
              />
              <div className="min-w-0 space-y-0.5">
                <ToastTitle className="font-medium" />
                <ToastDescription className="text-muted-foreground" />
              </div>
              <ToastClose
                aria-label="Dismiss"
                className="absolute top-3 right-3 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none">
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </ToastClose>
            </Toast>
          ),
        }}
      />
      <AlertDialog controller={ask.controller}>
        <AlertDialogBackdrop className="fixed inset-0 z-[70] bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialogContent<ConfirmOptions> className="fixed top-1/2 left-1/2 z-[71] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-md border border-border-strong bg-card p-5 shadow-2xl shadow-black/50 transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {(state) => (
            <>
              <div className="space-y-1.5">
                <AlertDialogTitle className="text-base font-medium">{state.payload?.title}</AlertDialogTitle>
                {state.payload?.description && (
                  <AlertDialogDescription className="text-sm text-muted-foreground">
                    {state.payload.description}
                  </AlertDialogDescription>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogClose className={`${buttonBase} border border-border-strong bg-muted/60 hover:bg-muted`}>
                  {state.payload?.cancelLabel ?? 'Cancel'}
                </AlertDialogClose>
                <AlertDialogClose value="confirm" className={`${buttonBase} border border-primary/50 bg-primary-solid text-white hover:border-primary`}>
                  {state.payload?.confirmLabel ?? 'Confirm'}
                </AlertDialogClose>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
