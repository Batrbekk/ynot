import { randomBytes } from 'node:crypto';

const isProd = () => process.env.NODE_ENV === 'production';

export const CART_COOKIE_NAME = isProd() ? '__Secure-ynot_cart' : 'ynot_cart';

export function generateCartToken(): string {
  return randomBytes(24).toString('base64url');
}

export function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd(),
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
