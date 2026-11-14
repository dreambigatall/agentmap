'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AppOverlays } from '@/components/ui/overlays';

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session, created once.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AppOverlays />
    </QueryClientProvider>
  );
}
