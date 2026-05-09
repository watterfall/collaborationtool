// Phase 1 middleware: cheap session-cookie presence check on protected
// routes. The actual session validation happens server-side in each
// page (`auth.api.getSession`). This is purely a soft redirect to
// surface the login UI faster.
//
// We CANNOT call better-auth from middleware because better-auth's
// session lookup needs to query Postgres, and the edge runtime doesn't
// support our Postgres client. Phase 1.5 evaluates a JWT-based session
// hint cookie that the middleware can verify without a DB roundtrip.

import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/docs', '/editor', '/orgs'];

export function middleware(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return undefined;

  // better-auth's default session cookie name is 'better-auth.session_token'
  // (configurable). If absent, redirect to login. Phase 1.5 will tighten
  // this with a signed cookie + JWT hint.
  const hasSessionCookie =
    request.cookies.has('better-auth.session_token') ||
    request.cookies.has('better-auth.session_data');

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return undefined;
}

export const config = {
  matcher: ['/docs/:path*', '/editor/:path*', '/orgs/:path*'],
};
