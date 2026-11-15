'use client';

import type { AgentColor, NamedItem, SkillVersion, SkillVersionSummary } from '@skillflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AppDialog } from '@/components/ui/dialog';
import { api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { StoryView } from './story-view';

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Every saved version of a skill, newest first. View shows that version's story;
 * Restore brings it back as a new version, so nothing in the history is ever lost.
 */
export function HistoryDialog({
  open,
  onOpenChange,
  workspaceId,
  skillId,
  currentVersion,
  agent,
  roles,
  channels,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  skillId: string;
  currentVersion: number;
  agent: { shortName: string; color: AgentColor };
  roles: NamedItem[];
  channels: NamedItem[];
  /** Absent for people who may only read. */
  onRestore?: (number: number) => Promise<void>;
}) {
  const path = { workspaceId, skillId };
  const [viewing, setViewing] = useState<number | null>(null);

  const versions = useQuery({
    queryKey: ['versions', workspaceId, skillId, currentVersion],
    queryFn: () =>
      call<SkillVersionSummary[]>(api.GET('/api/w/{workspaceId}/skills/{skillId}/versions', { params: { path } })),
    enabled: open,
  });

  const version = useQuery({
    queryKey: ['version', workspaceId, skillId, viewing],
    queryFn: () =>
      call<SkillVersion>(
        api.GET('/api/w/{workspaceId}/skills/{skillId}/versions/{number}', {
          params: { path: { ...path, number: viewing! } },
        }),
      ),
    enabled: open && viewing !== null,
    staleTime: Infinity,
  });

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setViewing(null);
      }}
      title={viewing === null ? 'Version history' : `Version ${viewing}`}
      description={
        viewing === null
          ? 'Every save is kept. Restoring brings an old version back as a new one.'
          : version.data && `${version.data.note} · ${version.data.author ?? 'Someone'} · ${when(version.data.createdAt)}`
      }
    >
      {viewing === null ? (
        <>
          {versions.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {versions.isError && <p className="text-sm text-danger">{versions.error.message}</p>}
          <ol className="-mx-2 max-h-[60vh] space-y-1 overflow-y-auto">
            {versions.data?.map((v) => {
              const current = v.number === currentVersion;
              return (
                <li
                  key={v.number}
                  className={cn('flex items-start gap-3 rounded-lg px-2 py-2', current && 'bg-muted')}
                >
                  <span className="mt-0.5 w-8 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                    v{v.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {v.note}
                      {current && <span className="ml-2 text-xs font-medium text-primary">Current</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.author ?? 'Someone'} · {when(v.createdAt)}
                    </p>
                  </div>
                  <span className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewing(v.number)}>
                      View
                    </Button>
                    {onRestore && !current && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await onRestore(v.number);
                          onOpenChange(false);
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <div className="space-y-4">
          {version.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {version.data && (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <p className="mb-3 text-sm font-semibold">{version.data.skill.name}</p>
              <StoryView skill={version.data.skill} agent={agent} roles={roles} channels={channels} />
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setViewing(null)}>
              ‹ All versions
            </Button>
            {onRestore && viewing !== currentVersion && (
              <Button
                onClick={async () => {
                  await onRestore(viewing);
                  onOpenChange(false);
                  setViewing(null);
                }}
              >
                Restore version {viewing}
              </Button>
            )}
          </div>
        </div>
      )}
    </AppDialog>
  );
}
