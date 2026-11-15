'use client';

import { AGENT_COLORS, agentInputSchema, type AgentColor, type AgentDetail } from '@skillflow/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/controls';
import { AppDialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { fieldErrors } from '@/features/auth/form-errors';
import { api, call } from '@/lib/api/client';
import { AgentBadge } from './agent-badge';

const COLOR_LABEL: Record<AgentColor, string> = {
  indigo: 'Indigo',
  teal: 'Teal',
  fuchsia: 'Fuchsia',
  amber: 'Amber',
  emerald: 'Emerald',
  rose: 'Rose',
  sky: 'Sky',
  violet: 'Violet',
};

/** Creates a new agent, or edits one when `agent` is given. */
export function AgentFormDialog({
  workspaceId,
  agent,
  open,
  onOpenChange,
  onSaved,
}: {
  workspaceId: string;
  agent?: AgentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (agent: AgentDetail) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [color, setColor] = useState<AgentColor>(agent?.color ?? 'indigo');
  const [shortName, setShortName] = useState(agent?.shortName ?? '');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { ...Object.fromEntries(new FormData(event.currentTarget)), color };
    const parsed = fieldErrors(agentInputSchema, values);
    if (parsed.errors) return setErrors(parsed.errors);
    setErrors({});
    setPending(true);
    const body = { ...parsed.data, description: parsed.data.description ?? '' };
    try {
      const saved = agent
        ? await call<AgentDetail>(
            api.PATCH('/api/w/{workspaceId}/agents/{agentId}', {
              params: { path: { workspaceId, agentId: agent.id } },
              body,
            }),
          )
        : await call<AgentDetail>(
            api.POST('/api/w/{workspaceId}/agents', { params: { path: { workspaceId } }, body }),
          );
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      setErrors({ fullName: (error as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={agent ? 'Edit agent' : 'New agent'}
      description={agent ? undefined : 'An AI agent your team is designing. You will describe its work as skills.'}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <TextField
          label="Name"
          name="fullName"
          defaultValue={agent?.fullName}
          placeholder="People Lifecycle Agent"
          error={errors.fullName}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Short name"
            name="shortName"
            defaultValue={agent?.shortName}
            placeholder="PLA"
            maxLength={6}
            hint="Up to 6 letters, for the badge."
            error={errors.shortName}
            onValueChange={(value: string) => setShortName(value)}
          />
          <SelectField<AgentColor>
            label="Colour"
            items={AGENT_COLORS.map((value) => ({ value, label: COLOR_LABEL[value] }))}
            value={color}
            onValueChange={setColor}
          />
        </div>
        <TextAreaField
          label="What it does"
          name="description"
          defaultValue={agent?.description}
          placeholder="Plans and scores KPIs, runs evaluations and prepares performance pay."
          rows={3}
          error={errors.description}
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            Preview <AgentBadge shortName={(shortName || 'NEW').toUpperCase().slice(0, 6)} color={color} className="ml-1" />
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {agent ? 'Save' : 'Create agent'}
            </Button>
          </div>
        </div>
      </form>
    </AppDialog>
  );
}
