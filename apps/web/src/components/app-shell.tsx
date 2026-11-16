'use client';

import type { Me, WorkspaceSummary } from '@skillflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { ColorSchemeValue } from '@ui-sdk/core';
import { usePreference } from '@ui-sdk/react/preferences';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { BRAND_NAME, BrandMark } from '@/components/brand';
import {
  AppMenuContent,
  AppMenuItem,
  AppMenuLabel,
  AppMenuRadioItem,
  AppMenuSeparator,
  AppMenuTrigger,
  Chevron,
  Menu,
  MenuGroup,
  MenuRadioGroup,
} from '@/components/ui/menu';
import { AgentsNav } from '@/features/agents/agents-nav';
import { useAgents } from '@/features/agents/queries';
import { NotificationBell } from '@/features/collaboration/notification-bell';
import { HealthStatus } from '@/features/health/health-status';
import { SearchButton } from '@/features/sharing/search-dialog';
import { api, call } from '@/lib/api/client';
import { colorScheme, THEME_LABEL } from '@/lib/preferences';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------- icons

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('size-[18px] shrink-0', className)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  templates: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 16.5h7M16.5 13v7',
  members: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6 1.7 1.7 0 0 0 9.97 3.04V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.24.6.82 1 1.47 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z',
};

function navFor(slug: string) {
  return [
    { href: `/w/${slug}`, label: 'Home', icon: ICONS.home, exact: true },
    { href: `/w/${slug}/templates`, label: 'Templates', icon: ICONS.templates, exact: true },
    { href: `/w/${slug}/settings/members`, label: 'Members', icon: ICONS.members, exact: true },
    { href: `/w/${slug}/settings`, label: 'Settings', icon: ICONS.settings, exact: true },
  ];
}

// ------------------------------------------------------------- top bar

function Logo({ slug }: { slug: string }) {
  return (
    <Link href={`/w/${slug}`} aria-label={`${BRAND_NAME} home`} className="shrink-0 rounded-md">
      <BrandMark />
    </Link>
  );
}

function Slash() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-border-strong" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 3 8 21" />
    </svg>
  );
}

function Initial({ text, className }: { text: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-sm bg-muted text-[11px] font-medium text-foreground',
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
    <Menu onAction={(value) => router.push(value === '__new' ? '/onboarding' : `/w/${String(value)}`)}>
      <AppMenuTrigger className="w-auto max-w-56 px-1.5 py-1" aria-label={`Workspace: ${workspace.name}. Switch workspace`}>
        <Initial text={workspace.name} />
        <span className="min-w-0 truncate text-sm">{workspace.name}</span>
        <span className="rounded-sm border border-border-strong px-1 font-mono text-[10px] text-muted-foreground uppercase">
          {workspace.level}
        </span>
        <Chevron />
      </AppMenuTrigger>
      <AppMenuContent className="w-64">
        <MenuGroup>
          <AppMenuLabel>Workspaces</AppMenuLabel>
          {me.workspaces.map((w) => (
            <AppMenuItem key={w.id} value={w.slug}>
              <Initial text={w.name} />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.id === workspace.id && <span className="text-xs text-primary">Current</span>}
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
  const theme = usePreference(colorScheme);
  return (
    <Menu
      onAction={async (value) => {
        if (value !== 'sign-out') return;
        await call(api.POST('/api/auth/sign-out')).catch(() => undefined);
        client.clear();
        router.replace('/sign-in');
      }}
    >
      <AppMenuTrigger className="w-auto rounded-full p-0.5" aria-label={`Account: ${me.name}`}>
        <Initial text={me.name} className="size-7 rounded-full border border-border-strong text-xs" />
      </AppMenuTrigger>
      <AppMenuContent className="w-60">
        <div className="border-b border-border px-2 pt-1.5 pb-2">
          <p className="truncate text-sm">{me.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </div>
        <MenuRadioGroup
          name="theme"
          value={theme.value}
          onValueChange={(value) => colorScheme.set(value as ColorSchemeValue)}
        >
          <AppMenuLabel>Theme</AppMenuLabel>
          {(['system', 'dark', 'light'] as const).map((option) => (
            <AppMenuRadioItem key={option} value={option}>
              {THEME_LABEL[option]}
            </AppMenuRadioItem>
          ))}
        </MenuRadioGroup>
        <AppMenuSeparator />
        <div className="px-2 py-2">
          <HealthStatus />
        </div>
        <AppMenuSeparator />
        <AppMenuItem value="sign-out">Sign out</AppMenuItem>
      </AppMenuContent>
    </Menu>
  );
}

/** The agent named in the address, for the breadcrumb. */
function AgentCrumb({ workspace }: { workspace: WorkspaceSummary }) {
  const pathname = usePathname();
  const agents = useAgents(workspace.id);
  const match = pathname.match(/\/agents\/([0-9a-f-]{36})/);
  const agent = match ? agents.data?.find((a) => a.id === match[1]) : undefined;
  if (!agent) return null;
  return (
    <>
      <Slash />
      <Link
        href={`/w/${workspace.slug}/agents/${agent.id}`}
        className="hidden min-w-0 truncate rounded-md px-1.5 py-1 text-sm hover:bg-muted sm:block"
      >
        {agent.fullName}
      </Link>
    </>
  );
}

// ------------------------------------------------------------- frame

/**
 * The frame every workspace page sits in: a top bar with breadcrumbs, search and account;
 * an icon rail that widens on hover or keyboard focus; a panel listing agents (or the
 * settings pages); and the page itself.
 */
export function AppShell({ me, workspace, children }: { me: Me; workspace: WorkspaceSummary; children: ReactNode }) {
  const pathname = usePathname();
  const nav = navFor(workspace.slug);
  const inSettings = pathname.startsWith(`/w/${workspace.slug}/settings`);
  const isActive = (href: string) => pathname === href;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden print:static print:block print:h-auto print:overflow-visible">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-background px-3 print:hidden">
        <Logo slug={workspace.slug} />
        <Slash />
        <WorkspaceMenu me={me} workspace={workspace} />
        <AgentCrumb workspace={workspace} />
        <div className="flex-1" />
        <div className="hidden w-56 sm:block">
          <SearchButton workspaceId={workspace.id} workspaceSlug={workspace.slug} />
        </div>
        <div className="sm:hidden">
          <SearchButton workspaceId={workspace.id} workspaceSlug={workspace.slug} shortcut={false} compact />
        </div>
        <NotificationBell workspaceId={workspace.id} />
        <AccountMenu me={me} />
      </header>

      <div className="flex min-h-0 flex-1 print:block">
        {/* Icon rail. Its labels show when it widens; they are always read by screen readers. */}
        <div className="relative hidden w-12 shrink-0 md:block print:hidden">
          <nav
            aria-label="Workspace"
            className="group absolute inset-y-0 left-0 z-40 flex w-12 flex-col gap-1 overflow-hidden border-r border-border bg-background py-2 transition-[width] duration-200 hover:w-48 hover:shadow-2xl hover:shadow-black/50 focus-within:w-48"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'mx-1.5 flex h-9 items-center gap-3 rounded-md px-2 text-sm whitespace-nowrap outline-none',
                  'focus-visible:ring-2 focus-visible:ring-primary/50',
                  isActive(item.href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon d={item.icon} />
                <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Second panel: the agents, or the settings pages. */}
        <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background lg:flex print:hidden">
          <div className="flex h-12 items-center border-b border-border px-4">
            <h2 className="text-base font-medium">{inSettings ? 'Settings' : 'Agents'}</h2>
          </div>
          <div className="flex-1 p-2 text-sm">
            {inSettings ? (
              <ul className="space-y-0.5">
                {[
                  { href: `/w/${workspace.slug}/settings`, label: 'General' },
                  { href: `/w/${workspace.slug}/settings/members`, label: 'Members' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className={cn(
                        'block rounded-md px-2 py-1.5',
                        isActive(item.href) ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <AgentsNav workspace={workspace} />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Small screens: the same places as the rail, as a scrolling row, and the agents. */}
          <div className="space-y-1 border-b border-border px-3 py-2 md:hidden print:hidden">
            <nav className="flex gap-1 overflow-x-auto text-sm" aria-label="Workspace">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5',
                    isActive(item.href) ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon d={item.icon} className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <details className="border-b border-border px-3 py-2 text-sm lg:hidden print:hidden">
            <summary className="cursor-pointer text-muted-foreground">Agents</summary>
            <div className="pt-2">
              <AgentsNav workspace={workspace} />
            </div>
          </details>
          <main className="relative flex-1 overflow-y-auto px-4 py-6 md:px-8 print:static print:overflow-visible print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
