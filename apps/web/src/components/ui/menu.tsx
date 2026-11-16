'use client';

import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@ui-sdk/react/menu';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Styled ui-sdk menu parts. The menu handles focus, arrow keys, typeahead and dismissal. */
export { Menu, MenuGroup, MenuRadioGroup };

export function AppMenuTrigger({ className, ...props }: ComponentProps<typeof MenuTrigger>) {
  return (
    <MenuTrigger
      className={cn(
        'flex w-full items-center gap-2 rounded-md text-left outline-none hover:bg-muted',
        'focus-visible:outline-2 focus-visible:outline-primary data-open:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

export function AppMenuContent({ className, ...props }: ComponentProps<typeof MenuContent>) {
  return (
    <MenuContent
      sideOffset={6}
      className={cn(
        'z-50 min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto rounded-md border border-border-strong',
        'bg-card p-1 text-sm shadow-xl shadow-black/40 outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function AppMenuItem({ className, ...props }: ComponentProps<typeof MenuItem>) {
  return (
    <MenuItem
      className={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none',
        'data-highlighted:bg-muted data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/** A choice of one in a MenuRadioGroup, with a check mark on the chosen one. */
export function AppMenuRadioItem({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof MenuRadioItem>, 'children'> & { children: ReactNode }) {
  return (
    <MenuRadioItem
      className={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none',
        'data-highlighted:bg-muted data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="grid size-4 shrink-0 place-items-center">
        <MenuItemIndicator>
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 text-primary" fill="none">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </MenuItemIndicator>
      </span>
      {children}
    </MenuRadioItem>
  );
}

export function AppMenuLabel({ children }: { children: ReactNode }) {
  return (
    <MenuGroupLabel className="px-2 pt-1.5 pb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
      {children}
    </MenuGroupLabel>
  );
}

export function AppMenuSeparator() {
  return <MenuSeparator className="my-1 h-px bg-border" />;
}

export function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-muted-foreground" fill="none">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
