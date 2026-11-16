'use client';

import { searchResultPath, type SearchResult, type SearchType } from '@skillflow/shared';
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import { useRouter } from 'next/navigation';
import { useState, type KeyboardEvent } from 'react';
import { AppDialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useSearch } from './queries';

const TYPE_LABEL: Record<SearchType, string> = {
  agent: 'Agent',
  capability: 'Capability',
  skill: 'Skill',
  step: 'Step',
  request: 'Request',
};

/** Ctrl+K (Command+K on Mac) finds agents, skills, steps and requests anywhere in the workspace. */
export function SearchButton({
  workspaceId,
  workspaceSlug,
  shortcut = true,
}: {
  workspaceId: string;
  workspaceSlug: string;
  /** The shell shows two buttons (desktop and phone); only one registers the shortcut. */
  shortcut?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useShortcut(shortcut ? 'mod+k' : null, () => setOpen(true), { description: 'Search' });
  const hint = useShortcutHint('mod+k');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts={hint.ariaKeyshortcuts}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="flex-1 text-left">Search</span>
        <kbd aria-hidden className="rounded border border-border px-1 text-[11px]">
          {hint.text}
        </kbd>
      </button>
      {open && (
        <SearchDialog
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SearchDialog({
  workspaceId,
  workspaceSlug,
  onClose,
}: {
  workspaceId: string;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const search = useSearch(workspaceId, q);
  const results = q.trim().length >= 2 ? (search.data?.results ?? []) : [];

  function go(result: SearchResult) {
    onClose();
    router.push(searchResultPath(workspaceSlug, result));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  }

  const optionId = (i: number) => `search-option-${i}`;

  return (
    <AppDialog open onOpenChange={(next) => !next && onClose()} title="Search this workspace">
      <div className="space-y-3">
        <input
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? optionId(active) : undefined}
          aria-label="Search agents, skills, steps and requests"
          placeholder="Agents, skills, steps, requests…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        {q.trim().length < 2 ? (
          <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>
        ) : search.isError ? (
          <p className="text-sm text-danger">{search.error.message}</p>
        ) : search.isPending ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing matches “{q.trim()}”.</p>
        ) : null}
        <ul id="search-results" role="listbox" aria-label="Results" className="max-h-80 space-y-0.5 overflow-y-auto">
          {results.map((result, i) => (
            <li
              key={`${result.type}-${result.id}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(result)}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm',
                i === active && 'bg-muted',
              )}
            >
              <span className="mt-0.5 w-20 shrink-0 text-xs text-muted-foreground">{TYPE_LABEL[result.type]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{result.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{result.context}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </AppDialog>
  );
}
