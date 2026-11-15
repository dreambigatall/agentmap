'use client';

import { Checkbox, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import { Textarea } from '@ui-sdk/react/textarea';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const controlClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors ' +
  'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'data-invalid:border-danger disabled:opacity-60';

/** Multi-line text with label, hint and error, wired by ui-sdk's Field. */
export function TextAreaField({
  label,
  error,
  hint,
  hideLabel,
  className,
  name,
  ...textarea
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  className?: string;
} & Omit<ComponentProps<typeof Textarea>, 'className'>) {
  return (
    <Field name={name} invalid={error ? true : undefined} className={cn('space-y-1.5', className)}>
      <FieldLabel className={cn('block text-sm font-medium', hideLabel && 'sr-only')}>{label}</FieldLabel>
      <Textarea name={name} rows={2} className={cn(controlClass, 'resize-y')} {...textarea} />
      {hint && !error && <FieldDescription className="text-xs text-muted-foreground">{hint}</FieldDescription>}
      {error && (
        <FieldError match className="text-xs text-danger">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

/** A checkbox with its label beside it. Pressing the label toggles it. */
export function CheckboxField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field className={cn('flex items-start gap-2', className)}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-border bg-card outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary/40 data-checked:border-primary data-checked:bg-primary',
        )}
      >
        <CheckboxIndicator className="text-primary-foreground" aria-hidden>
          <svg viewBox="0 0 16 16" className="size-3" fill="none">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" />
          </svg>
        </CheckboxIndicator>
      </Checkbox>
      <div className="min-w-0">
        <FieldLabel className="text-sm">{label}</FieldLabel>
        {description && <FieldDescription className="text-xs text-muted-foreground">{description}</FieldDescription>}
      </div>
    </Field>
  );
}

/** An on/off setting with its label and an optional description. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
        {description && <FieldDescription className="text-xs text-muted-foreground">{description}</FieldDescription>}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-border p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 data-checked:bg-primary"
      >
        <SwitchThumb className="size-4 rounded-full bg-card shadow transition-transform data-checked:translate-x-4" />
      </Switch>
    </Field>
  );
}
