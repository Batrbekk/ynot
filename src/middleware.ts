import { NextResponse, type NextRequest } from 'next/server';
import { ATTRIBUTION_COOKIE_NAME, extractAttributionFromUrl } from '@/server/attribution/cookie';

// Auth.js session cookie (see `src/server/auth/config.ts`).
const SESSION_COOKIE = 'ynot.session-token';

/**
 * Combined edge proxy:
 *
 * 1. UTM / referrer attribution (Phase 4) — runs everywhere except `_next` and
 *    static assets.
 * 2. `/admin/*` + `/api/admin/*` optimistic auth gate — Auth.js stores session
 *    state as a JWT cookie; the real role check happens in the layout / each
 *    route handler (`requireAdmin()`), but we short-circuit here when the
 *    cookie is missing entirely. Page requests redirect to /sign-in; API
 *    requests get a 401 JSON body.
 *
 * The middleware-level check is deliberately optimistic — running a Prisma
 * query here is too expensive (Auth.js docs §authentication: "avoid database
 * checks to prevent performance issues"). Defense-in-depth lives one layer
 * deeper.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/((?!api|_next|favicon.ico).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1) Admin auth gate.
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    const hasSession = req.cookies.get(SESSION_COOKIE)?.value;
    if (!hasSession) {
      if (path.startsWith('/api/admin')) {
        return NextResponse.json(
          { error: 'UNAUTHENTICATED' },
          { status: 401 },
        );
      }
      const signIn = new URL('/sign-in', req.url);
      signIn.searchParams.set('next', path);
      return NextResponse.redirect(signIn);
    }
    // Session cookie present — continue to layout / handler for role check.
    return NextResponse.next();
  }

  // 2) Phase 4 attribution capture.
  const att = extractAttributionFromUrl(url, path, req.headers.get('referer'));
  const res = NextResponse.next();
  if (att) {
    res.cookies.set(ATTRIBUTION_COOKIE_NAME, JSON.stringify(att), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  return res;
}
