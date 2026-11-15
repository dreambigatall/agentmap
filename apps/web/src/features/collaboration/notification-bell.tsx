'use client';

import { useQueryClient } from '@tanstack/react-query';
import { MenuTrigger } from '@ui-sdk/react/menu';
import { useRouter } from 'next/navigation';
import { AppMenuContent, AppMenuItem, AppMenuSeparator, Menu } from '@/components/ui/menu';
import { api, call } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { collabKeys, useNotifications } from './queries';

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The bell: what is waiting for this person. Checks every minute. */
export function NotificationBell({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const list = useNotifications(workspaceId);
  const unread = list.data?.unread ?? 0;

  async function markRead(ids?: string[]) {
    await call(api.POST('/api/w/{workspaceId}/notifications/read', { params: { path: { workspaceId } }, body: { ids } })).catch(
      () => undefined,
    );
    await client.invalidateQueries({ queryKey: collabKeys.notifications(workspaceId) });
  }

  return (
    <Menu
      onAction={(value) => {
        if (value === '__all') return void markRead();
        const item = list.data?.items.find((n) => n.id === value);
        if (!item) return;
        if (!item.read) void markRead([item.id]);
        router.push(item.link);
      }}
    >
      <MenuTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary data-open:bg-muted"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </MenuTrigger>
      <AppMenuContent className="w-80 max-w-[calc(100vw-32px)]">
        {list.data?.items.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing yet.</p>}
        {list.data?.items.slice(0, 15).map((n) => (
          <AppMenuItem key={n.id} value={n.id} className="items-start gap-2 py-2">
            <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
            <span className="min-w-0">
              <span className={cn('block text-sm leading-snug', !n.read && 'font-medium')}>{n.text}</span>
              <span className="text-xs text-muted-foreground">
                {ago(n.createdAt)}
                {!n.read && <span className="sr-only">, unread</span>}
              </span>
            </span>
          </AppMenuItem>
        ))}
        {unread > 0 && (
          <>
            <AppMenuSeparator />
            <AppMenuItem value="__all" className="justify-center text-xs text-primary">
              Mark all as read
            </AppMenuItem>
          </>
        )}
      </AppMenuContent>
    </Menu>
  );
}
