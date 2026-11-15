import type { AgentColor, NamedItem } from '@skillflow/shared';
import { cn } from '@/lib/utils';
import { AgentBadge } from '../agents/agent-badge';
import type { NodeMark } from '../flow/flow-diagram';

export interface StoryAgent {
  shortName: string;
  color: AgentColor;
}

/** What the story needs. Works for saved skills and for the editor's unsaved draft. */
export interface StorySkill {
  startedByRoleId: string | null;
  trigger: string;
  steps: Array<{ key?: string; id?: string; roleId: string | null; text: string; isApproval: boolean; ifNo: string }>;
  inputs: Array<{ key?: string; id?: string; label: string; need: 'automatic' | 'required' }>;
  channels: Array<{ channelId: string; usage: string }>;
  deliverable: string;
  humanControl: string;
}

function Actor({ roleId, agent, roles }: { roleId: string | null; agent: StoryAgent; roles: Map<string, string> }) {
  if (roleId === null) return <AgentBadge shortName={agent.shortName} color={agent.color} />;
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded border border-border px-1.5 text-[11px] font-medium">
      {roles.get(roleId) ?? 'Unknown role'}
    </span>
  );
}

function Missing({ children }: { children: string }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}

/**
 * The skill told as a story, top to bottom: what starts it, each step and who does it,
 * where a person decides, what it delivers. This is what a business owner reads and signs off.
 */
export function StoryView({
  skill,
  agent,
  roles,
  channels,
  marks,
}: {
  skill: StorySkill;
  agent: StoryAgent;
  roles: NamedItem[];
  channels: NamedItem[];
  /** New and changed steps since the last save, by step id. */
  marks?: Map<string, NodeMark>;
}) {
  const roleNames = new Map(roles.map((r) => [r.id, r.name]));
  const channelNames = new Map(channels.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-5 text-sm">
      <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
        <li className="relative flex gap-3">
          <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            ▶
          </span>
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <Actor roleId={skill.startedByRoleId} agent={agent} roles={roleNames} />
              <span className="text-xs text-muted-foreground">
                {skill.startedByRoleId === null ? 'starts it by itself' : 'starts it'}
              </span>
            </div>
            <p>{skill.trigger.trim() || <Missing>What starts it?</Missing>}</p>
          </div>
        </li>

        {skill.steps.map((step, index) => (
          <li key={step.key ?? step.id ?? index} className="relative flex gap-3">
            <span
              className={cn(
                'z-10 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums',
                step.isApproval ? 'border-warning bg-warning/20' : 'border-border bg-card',
              )}
            >
              {index + 1}
            </span>
            <div
              className={cn(
                'min-w-0 flex-1 space-y-1 pt-0.5',
                step.isApproval && '-mt-1 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Actor roleId={step.roleId} agent={agent} roles={roleNames} />
                {step.isApproval && <span className="text-xs font-medium">Approval</span>}
                {step.id && marks?.get(step.id) && (
                  <span
                    className={cn(
                      'rounded px-1.5 text-[11px] font-medium',
                      marks.get(step.id) === 'new' ? 'bg-success/25' : 'bg-primary/20',
                    )}
                  >
                    {marks.get(step.id) === 'new' ? 'New' : 'Changed'}
                  </span>
                )}
                {step.isApproval && step.roleId === null && (
                  <span className="text-xs text-danger">An approval needs a person</span>
                )}
              </div>
              <p>{step.text.trim() || <Missing>Describe this step</Missing>}</p>
              {step.isApproval && step.ifNo.trim() && (
                <p className="text-xs text-muted-foreground">If no: {step.ifNo}</p>
              )}
            </div>
          </li>
        ))}
        {skill.steps.length === 0 && (
          <li className="relative flex gap-3">
            <span className="z-10 size-6 shrink-0 rounded-full border border-dashed border-border bg-card" />
            <Missing>No steps yet</Missing>
          </li>
        )}

        <li className="relative flex gap-3">
          <span className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-success text-[11px] font-semibold text-white">
            ✓
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-medium text-muted-foreground">Delivers</p>
            <p>{skill.deliverable.trim() || <Missing>What exists when it is done?</Missing>}</p>
          </div>
        </li>
      </ol>

      <div className="rounded-lg bg-muted px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Always stays with a person</p>
        <p>{skill.humanControl.trim() || <Missing>What must a person always decide?</Missing>}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Information it needs</p>
          {skill.inputs.length === 0 ? (
            <Missing>None listed</Missing>
          ) : (
            <ul className="space-y-1">
              {skill.inputs.map((input, i) => (
                <li key={input.key ?? input.id ?? i} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">{input.label || <Missing>Unnamed</Missing>}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {input.need === 'automatic' ? 'automatic' : 'from a person'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Where it talks to people</p>
          {skill.channels.length === 0 ? (
            <Missing>No channels</Missing>
          ) : (
            <ul className="space-y-1">
              {skill.channels.map((c) => (
                <li key={c.channelId}>
                  <span className="font-medium">{channelNames.get(c.channelId) ?? 'Unknown'}</span>
                  {c.usage && <span className="text-muted-foreground">: {c.usage}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
