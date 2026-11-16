'use client';

import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Styled ui-sdk tabs: arrow keys move between tabs, one tab stop for the list. */
export { Tabs };

export function AppTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn('flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border', className)}
      {...props}
    />
  );
}

export function AppTab({ className, ...props }: ComponentProps<typeof TabsTab>) {
  return (
    <TabsTab
      className={cn(
        '-mb-px shrink-0 border-b-2 border-transparent px-2.5 py-2 text-sm whitespace-nowrap text-muted-foreground outline-none',
        'hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40',
        'data-selected:border-foreground data-selected:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function AppTabPanel({ className, ...props }: ComponentProps<typeof TabsPanel>) {
  return <TabsPanel className={cn('pt-5 outline-none', className)} {...props} />;
}
