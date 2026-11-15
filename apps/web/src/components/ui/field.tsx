'use client';

import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from '@ui-sdk/react/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from '@ui-sdk/react/select';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const controlClass =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors ' +
  'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'data-invalid:border-danger [&:read-only:not(button)]:bg-muted [&:read-only:not(button)]:text-muted-foreground disabled:opacity-60';

const labelClass = 'block text-sm font-medium';

interface FieldParts {
  label: string;
  /** A problem to show under the control, from our checks or the server. */
  error?: string;
  hint?: ReactNode;
  hideLabel?: boolean;
  className?: string;
}

/**
 * Label, control, hint and error wired together by ui-sdk's Field (ids, aria-describedby,
 * aria-invalid). Errors come from our shared Zod schemas or the API, not from the browser.
 */
function FieldFrame({
  label,
  error,
  hint,
  hideLabel,
  className,
  name,
  children,
}: FieldParts & { name?: string; children: ReactNode }) {
  return (
    <Field name={name} invalid={error ? true : undefined} className={cn('space-y-1.5', className)}>
      <FieldLabel className={cn(labelClass, hideLabel && 'sr-only')}>{label}</FieldLabel>
      {children}
      {hint && !error && <FieldDescription className="text-xs text-muted-foreground">{hint}</FieldDescription>}
      {error && (
        <FieldError match className="text-xs text-danger">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

export function TextField({
  label,
  error,
  hint,
  hideLabel,
  className,
  name,
  ...input
}: FieldParts & Omit<ComponentProps<typeof Input>, 'className'>) {
  return (
    <FieldFrame label={label} error={error} hint={hint} hideLabel={hideLabel} className={className} name={name}>
      <Input name={name} className={controlClass} {...input} />
    </FieldFrame>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function PasswordField({
  label,
  error,
  hint,
  className,
  name,
  autoComplete,
}: FieldParts & { name: string; autoComplete: 'current-password' | 'new-password' }) {
  return (
    <FieldFrame label={label} error={error} hint={hint} className={className} name={name}>
      <PasswordInput name={name} autoComplete={autoComplete} className="relative block">
        <PasswordInputControl className={cn(controlClass, 'pr-10')} />
        <PasswordInputToggle
          aria-label="Show password"
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {(state) => <EyeIcon open={!state.visible} />}
        </PasswordInputToggle>
      </PasswordInput>
    </FieldFrame>
  );
}

export interface Choice<V extends string> {
  value: V;
  label: string;
  description?: string;
}

export function SelectField<V extends string>({
  label,
  error,
  hint,
  hideLabel,
  className,
  name,
  items,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: FieldParts & {
  name?: string;
  items: Choice<V>[];
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  disabled?: boolean;
}) {
  return (
    <FieldFrame label={label} error={error} hint={hint} hideLabel={hideLabel} className={className} name={name}>
      <Select
        name={name}
        items={items.map(({ value: v, label: l }) => ({ value: v, label: l }))}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === 'string') onValueChange?.(next as V);
        }}
      >
        <SelectTrigger
          className={cn(
            controlClass,
            'flex items-center justify-between gap-2 text-left data-open:border-primary',
          )}
        >
          <SelectValue className="truncate" />
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-muted-foreground" fill="none">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </SelectTrigger>
        <SelectContent
          sideOffset={4}
          className="z-50 min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg outline-none"
        >
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="flex cursor-default items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block">{item.label}</span>
                {item.description && (
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                )}
              </span>
              <SelectItemIndicator className="mt-0.5 text-primary">
                <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
                  <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </SelectItemIndicator>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}
