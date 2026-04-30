import { cookies } from 'next/headers';
import { getSessionUser } from '@/server/auth/session';
import { getOrCreateCart } from './service';
import { mergeGuestIntoUser } from './merge';
import { CART_COOKIE_NAME, cartCookieOptions, generateCartToken } from './token';

/**
 * Resolves the active cart for the current request. May:
 *  - merge guest cart into user cart on first authenticated request
 *  - rotate guest cart cookie
 *  - return an existing cart unchanged
 *
 * Always returns a cart row with items.
 */
export async function resolveCart() {
  const user = await getSessionUser();
  const cookieJar = await cookies();
  const guestToken = cookieJar.get(CART_COOKIE_NAME)?.value ?? null;

  if (user) {
    if (guestToken) {
      const merged = await mergeGuestIntoUser({ userId: user.id, guestSessionToken: guestToken });
      cookieJar.delete(CART_COOKIE_NAME);
      return merged;
    }
    return getOrCreateCart({ userId: user.id, sessionToken: null });
  }

  let token = guestToken;
  if (!token) {
    token = generateCartToken();
    cookieJar.set(CART_COOKIE_NAME, token, cartCookieOptions());
  }
  const cart = await getOrCreateCart({ userId: null, sessionToken: token });
  // If the cookie pointed to a since-deleted cart, getOrCreateCart created a fresh one
  // with the same token — no rotation needed.
  return cart;
}
