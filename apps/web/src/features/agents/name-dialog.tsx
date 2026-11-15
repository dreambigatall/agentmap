'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { AppDialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';

/** A small dialog that asks for one name: a new capability, a new skill, a rename. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  initial = '',
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  initial?: string;
  submitLabel: string;
  /** Throw to show the message under the field. */
  onSubmit: (name: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name) return setError('Enter a name');
    setError(null);
    setPending(true);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <TextField
          label={label}
          name="name"
          defaultValue={initial}
          placeholder={placeholder}
          error={error ?? undefined}
          maxLength={120}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
