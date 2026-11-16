import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_NAME, BrandMark } from '@/components/brand';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2" aria-label={`${BRAND_NAME} home`}>
        <BrandMark className="size-8" />
        <span className="text-lg font-medium">{BRAND_NAME}</span>
      </Link>
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
