import { prisma } from '@/server/db/client';

/**
 * Hourly job: hard-delete every Cart whose `expiresAt` is in the past.
 *
 * Cascade rules on `Cart` clear `CartItem` and `CartEvent` rows; `User` and
 * `PromoCode` foreign keys use `SetNull` so account / promo data survives.
 *
 * Idempotent: a second run on an empty result set returns `{ deleted: 0 }`.
 */
export async function cleanupExpiredCarts(): Promise<{ deleted: number }> {
  const r = await prisma.cart.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return { deleted: r.count };
}
