import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2" aria-label="Skillflow home">
        <span className="grid size-8 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground">
          S
        </span>
        <span className="text-lg font-semibold">Skillflow</span>
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
