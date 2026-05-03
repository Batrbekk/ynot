import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { cleanupExpiredCarts } from '../cleanup-expired-carts';

async function seedCart(expiresAt: Date) {
  return prisma.cart.create({ data: { expiresAt } });
}

describe('cleanupExpiredCarts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zero when nothing is expired', async () => {
    await seedCart(new Date(Date.now() + 60_000));
    const r = await cleanupExpiredCarts();
    expect(r).toEqual({ deleted: 0 });
    expect(await prisma.cart.count()).toBe(1);
  });

  it('deletes carts whose expiresAt is in the past', async () => {
    await seedCart(new Date(Date.now() - 60_000));
    await seedCart(new Date(Date.now() - 60 * 60 * 1000));
    await seedCart(new Date(Date.now() + 60_000));
    const r = await cleanupExpiredCarts();
    expect(r.deleted).toBe(2);
    expect(await prisma.cart.count()).toBe(1);
  });

  it('cascades to CartItem and CartEvent rows', async () => {
    const cart = await seedCart(new Date(Date.now() - 60_000));
    await prisma.cartEvent.create({ data: { cartId: cart.id, kind: 'CREATED' } });
    expect(await prisma.cartEvent.count()).toBe(1);
    await cleanupExpiredCarts();
    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartEvent.count()).toBe(0);
  });

  it('is idempotent: a second call after cleanup returns 0', async () => {
    await seedCart(new Date(Date.now() - 60_000));
    await cleanupExpiredCarts();
    const r = await cleanupExpiredCarts();
    expect(r.deleted).toBe(0);
  });
});
