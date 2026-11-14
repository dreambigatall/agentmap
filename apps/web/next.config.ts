import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // The shared package is compiled TypeScript inside this repository.
  transpilePackages: ['@skillflow/shared'],
  // The browser calls /api/* on this app's own address, and Next.js forwards it to
  // the NestJS API. Cookies then belong to one site, which keeps sign-in simple.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
