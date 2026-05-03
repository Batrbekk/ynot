import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { enqueueAbandonedCart } from '../enqueue-abandoned-cart';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function seedUser() {
  return prisma.user.create({
    data: {
      email: `shopper-${Math.random().toString(36).slice(2, 8)}@ynot.test`,
      name: 'Shopper',
    },
  });
}

async function seedProduct() {
  return prisma.product.create({
    data: {
      slug: 'cart-product-' + Math.random().toString(36).slice(2, 8),
      name: 'Silk Scarf',
      description: '',
      priceCents: 5000,
      materials: 'Silk',
      care: 'Dry clean',
      sizing: 'One size',
      images: { create: [{ url: '/img/scarf.jpg', alt: '', sortOrder: 0 }] },
    },
  });
}

interface SeedCartOpts {
  userId?: string | null;
  expiresAt?: Date;
  itemAddedAt?: Date | null;
  checkedOut?: boolean;
  productId?: string;
}

async function seedCart(opts: SeedCartOpts) {
  const cart = await prisma.cart.create({
    data: {
      userId: opts.userId ?? null,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 7 * DAY_MS),
    },
  });
  if (opts.productId) {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: opts.productId,
        size: 'M',
        colour: 'Black',
        quantity: 1,
        unitPriceCents: 5000,
      },
    });
  }
  if (opts.itemAddedAt) {
    await prisma.cartEvent.create({
      data: {
        cartId: cart.id,
        kind: 'ITEM_ADDED',
        createdAt: opts.itemAddedAt,
      },
    });
  }
  if (opts.checkedOut) {
    await prisma.cartEvent.create({ data: { cartId: cart.id, kind: 'CHECKED_OUT' } });
  }
  return cart;
}

describe('enqueueAbandonedCart', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zero counts when no carts are in the abandonment windows', async () => {
    const r = await enqueueAbandonedCart();
    expect(r).toEqual({ enqueued1h: 0, enqueued24h: 0 });
    expect(await prisma.emailJob.count()).toBe(0);
  });

  it('enqueues AbandonedCart1h for carts whose ITEM_ADDED is ~1h ago', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      itemAddedAt: new Date(Date.now() - HOUR_MS),
    });

    const r = await enqueueAbandonedCart();
    expect(r.enqueued1h).toBe(1);

    const jobs = await prisma.emailJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].template).toBe('AbandonedCart1h');
    expect(jobs[0].recipientEmail).toBe(user.email);
    expect(jobs[0].cancelReason).toMatch(/:1h$/);
  });

  it('enqueues AbandonedCart24h with a freshly minted promo code', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      itemAddedAt: new Date(Date.now() - DAY_MS),
    });

    const r = await enqueueAbandonedCart();
    expect(r.enqueued24h).toBe(1);

    const jobs = await prisma.emailJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].template).toBe('AbandonedCart24h');
    const payload = jobs[0].payload as { promoCode: string; promoExpiresAt: string };
    expect(payload.promoCode).toMatch(/^WELCOME10-[A-Z0-9_-]{6}$/);
    const promo = await prisma.promoCode.findUniqueOrThrow({
      where: { code: payload.promoCode },
    });
    expect(promo.discountType).toBe('PERCENT');
    expect(promo.discountValue).toBe(10);
    expect(promo.usageLimit).toBe(1);
    expect(promo.expiresAt).not.toBeNull();
  });

  it('skips carts already CHECKED_OUT', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      itemAddedAt: new Date(Date.now() - HOUR_MS),
      checkedOut: true,
    });
    const r = await enqueueAbandonedCart();
    expect(r).toEqual({ enqueued1h: 0, enqueued24h: 0 });
  });

  it('skips anonymous carts (no userId, no recipient)', async () => {
    const product = await seedProduct();
    await seedCart({
      productId: product.id,
      itemAddedAt: new Date(Date.now() - HOUR_MS),
    });
    const r = await enqueueAbandonedCart();
    expect(r.enqueued1h).toBe(0);
  });

  it('skips empty carts', async () => {
    const user = await seedUser();
    await seedCart({
      userId: user.id,
      itemAddedAt: new Date(Date.now() - HOUR_MS),
    });
    const r = await enqueueAbandonedCart();
    expect(r.enqueued1h).toBe(0);
  });

  it('skips carts past their expiresAt', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      expiresAt: new Date(Date.now() - 60_000),
      itemAddedAt: new Date(Date.now() - HOUR_MS),
    });
    const r = await enqueueAbandonedCart();
    expect(r).toEqual({ enqueued1h: 0, enqueued24h: 0 });
  });

  it('ignores carts whose ITEM_ADDED is outside the ±5 min window', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      itemAddedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    });
    const r = await enqueueAbandonedCart();
    expect(r).toEqual({ enqueued1h: 0, enqueued24h: 0 });
  });

  it('is idempotent within the window — repeated runs do not duplicate jobs (dedup by cartId:1h)', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    await seedCart({
      userId: user.id,
      productId: product.id,
      itemAddedAt: new Date(Date.now() - HOUR_MS),
    });
    await enqueueAbandonedCart();
    await enqueueAbandonedCart();
    expect(await prisma.emailJob.count()).toBe(1);
  });

  it('treats 1h and 24h as separate dedup keys (different cohorts can co-exist)', async () => {
    const user = await seedUser();
    const product = await seedProduct();
    const cart = await seedCart({ userId: user.id, productId: product.id });
    // Two ITEM_ADDED events, one 1h ago and one 24h ago.
    await prisma.cartEvent.create({
      data: { cartId: cart.id, kind: 'ITEM_ADDED', createdAt: new Date(Date.now() - HOUR_MS) },
    });
    await prisma.cartEvent.create({
      data: { cartId: cart.id, kind: 'ITEM_ADDED', createdAt: new Date(Date.now() - DAY_MS) },
    });
    const r = await enqueueAbandonedCart();
    expect(r).toEqual({ enqueued1h: 1, enqueued24h: 1 });
    expect(await prisma.emailJob.count()).toBe(2);
  });
});
