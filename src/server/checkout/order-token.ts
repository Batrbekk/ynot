import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/server/env';

// Use '~' as separator since it doesn't appear in base64url, ISO dates, or CUIDs.
const SEPARATOR = '~';

function hmac(payload: string): string {
  return createHmac('sha256', env.ORDER_TOKEN_SECRET).update(payload).digest('base64url');
}

/**
 * Signs an order id + createdAt timestamp into a base64url token of form
 * "<orderId>~<createdAtIso>~<signature>". Used as the __ynot_order_token cookie
 * value for unauthenticated ghost orders (24h TTL enforced at issue site).
 */
export function signOrderToken(orderId: string, createdAt: Date): string {
  const iso = createdAt.toISOString();
  const payload = `${orderId}${SEPARATOR}${iso}`;
  return `${payload}${SEPARATOR}${hmac(payload)}`;
}

export function verifyOrderToken(token: string): { orderId: string; createdAt: string } | null {
  if (!token) return null;
  const lastSep = token.lastIndexOf(SEPARATOR);
  if (lastSep === -1) return null;
  const sig = token.slice(lastSep + 1);
  const payload = token.slice(0, lastSep);
  const firstSep = payload.indexOf(SEPARATOR);
  if (firstSep === -1) return null;
  const orderId = payload.slice(0, firstSep);
  const iso = payload.slice(firstSep + 1);
  if (!orderId || !iso) return null;
  const expected = hmac(payload);
  try {
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { orderId, createdAt: iso };
}
