import { NextResponse, type NextRequest } from 'next/server';

/** Set by the API next to the session cookies. Holds no secret; it only says "signed in before". */
const SESSION_COOKIE = 'sf_session';

/**
 * Sends signed-out visitors to the sign-in page before any protected page renders.
 * The real check happens in the API on every request; this only avoids a flash of
 * an empty app for someone who is not signed in.
 */
export function middleware(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname, search } = request.nextUrl;

  // The home page is public: signed-out visitors see it, everyone else goes to their workspace.
  if (pathname === '/') {
    if (!signedIn) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/w';
    return NextResponse.redirect(url);
  }

  if (!signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = pathname === '/w' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/w/:path*', '/w', '/onboarding'],
};
