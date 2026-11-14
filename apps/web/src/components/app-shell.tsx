'use client';

import type { Me, WorkspaceSummary } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  AppMenuContent,
  AppMenuItem,
  AppMenuLabel,
  AppMenuSeparator,
  AppMenuTrigger,
  Chevron,
  Menu,
  MenuGroup,
} from '@/components/ui/menu';
import { HealthStatus } from '@/features/health/health-status';
import { api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';

function navFor(slug: string) {
  return [
    { href: `/w/${slug}`, label: 'Dashboard' },
    { href: `/w/${slug}/settings/members`, label: 'Members' },
    { href: `/w/${slug}/settings`, label: 'Settings' },
  ];
}

function Initial({ text, className }: { text: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary',
        className,
      )}
    >
      {text.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Switches workspaces or starts a new one. A ui-sdk Menu: arrow keys, typeahead, Escape. */
function WorkspaceMenu({ me, workspace }: { me: Me; workspace: WorkspaceSummary }) {
  const router = useRouter();
  return (
    <Menu
      onAction={(value) => {
        router.push(value === '__new' ? '/onboarding' : `/w/${String(value)}`);
      }}
    >
      <AppMenuTrigger className="px-2 py-1.5" aria-label={`Workspace: ${workspace.name}. Switch workspace`}>
        <Initial text={workspace.name} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{workspace.name}</span>
        <Chevron />
      </AppMenuTrigger>
      <AppMenuContent>
        <MenuGroup>
          <AppMenuLabel>Workspaces</AppMenuLabel>
          {me.workspaces.map((w) => (
            <AppMenuItem key={w.id} value={w.slug}>
              <Initial text={w.name} className="size-6" />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && <span className="text-xs text-muted-foreground">Current</span>}
            </AppMenuItem>
          ))}
        </MenuGroup>
        <AppMenuSeparator />
        <AppMenuItem value="__new">+ New workspace</AppMenuItem>
      </AppMenuContent>
    </Menu>
  );
}

/** The signed-in person's menu: who they are, and sign out. */
function AccountMenu({ me }: { me: Me }) {
  const router = useRouter();
  const client = useQueryClient();

  return (
    <Menu
      onAction={async (value) => {
        if (value !== 'sign-out') return;
        await call(api.POST('/api/auth/sign-out')).catch(() => undefined);
        client.clear();
        router.replace('/sign-in');
      }}
    >
      <AppMenuTrigger className="px-2 py-1.5" aria-label={`Account: ${me.name}`}>
        <Initial text={me.name} className="rounded-full bg-muted text-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{me.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
        </span>
        <Chevron />
      </AppMenuTrigger>
      <AppMenuContent>
        <AppMenuItem value="sign-out">Sign out</AppMenuItem>
      </AppMenuContent>
    </Menu>
  );
}

/** The frame every workspace page sits in: sidebar on the left, top bar above the content. */
export function AppShell({
  me,
  workspace,
  children,
}: {
  me: Me;
  workspace: WorkspaceSummary;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const nav = navFor(workspace.slug);

  const navLink = (item: { href: string; label: string }, mobile = false) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block rounded-md',
          mobile ? 'shrink-0 px-3 py-1.5' : 'px-2 py-1.5',
          active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
        )}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            S
          </span>
          <span className="font-semibold">Skillflow</span>
        </div>
        <div className="border-b border-border p-2">
          <WorkspaceMenu me={me} workspace={workspace} />
        </div>
        <nav className="flex-1 space-y-6 p-3 text-sm" aria-label="Workspace">
          <div>
            <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Agents</p>
            <p className="px-2 py-1.5 text-muted-foreground">No agents yet</p>
          </div>
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.href}>{navLink(item)}</li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-border p-2">
          <div className="px-2">
            <HealthStatus />
          </div>
          <AccountMenu me={me} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="space-y-2 border-b border-border bg-card px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <WorkspaceMenu me={me} workspace={workspace} />
            </div>
            <div className="w-40 shrink-0">
              <AccountMenu me={me} />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto text-sm" aria-label="Workspace">
            {nav.map((item) => navLink(item, true))}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
