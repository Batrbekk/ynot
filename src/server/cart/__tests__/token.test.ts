import { describe, expect, it } from 'vitest';
import {
  generateCartToken,
  CART_COOKIE_NAME,
  cartCookieOptions,
} from '../token';

describe('cart cookie helpers', () => {
  it('generates a 24-byte (32-char base64url) token', () => {
    const t = generateCartToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(32);
  });

  it('emits a different token each call', () => {
    expect(generateCartToken()).not.toBe(generateCartToken());
  });

  it('cartCookieOptions sets HttpOnly + SameSite + 30-day TTL', () => {
    const opts = cartCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
    expect(opts.path).toBe('/');
  });

  it('is not secure in test/dev environment', () => {
    // NODE_ENV === 'test' in vitest — secure should be false
    const opts = cartCookieOptions();
    expect(opts.secure).toBe(false);
    // Cookie name uses no __Secure- prefix outside production
    expect(CART_COOKIE_NAME).toBe('ynot_cart');
  });
});
