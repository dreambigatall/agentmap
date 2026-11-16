'use client';

import { Button as SdkButton } from '@ui-sdk/react/button';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'border border-primary/50 bg-primary-solid text-white hover:border-primary hover:bg-primary-solid/85',
  secondary: 'border border-border-strong bg-muted/60 text-foreground hover:border-muted-foreground/50 hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
} as const;

const sizes = {
  md: 'h-8 px-3 text-sm',
  sm: 'h-7 px-2.5 text-xs',
} as const;

export type ButtonProps = Omit<ComponentProps<typeof SdkButton>, 'children' | 'className'> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Shows the spinner and blocks presses, for work the button does not own (a form submit). */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * ui-sdk Button with our look. An onClick that returns a Promise keeps the button
 * pending on its own (data-pending), so it cannot be pressed twice.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <SdkButton
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-md font-normal whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-60 data-pending:cursor-progress',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent',
          loading ? 'inline-block' : 'hidden group-data-pending:inline-block',
        )}
      />
      {children}
    </SdkButton>
  );
}
