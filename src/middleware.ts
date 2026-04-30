import { NextResponse, type NextRequest } from 'next/server';
import { ATTRIBUTION_COOKIE_NAME, extractAttributionFromUrl } from '@/server/attribution/cookie';

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const att = extractAttributionFromUrl(url, url.pathname, req.headers.get('referer'));
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
