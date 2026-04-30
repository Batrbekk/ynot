import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';

describe('webhook handler', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  it('rejects on invalid signature', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => { throw new Error('bad sig'); }) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const result = await handleWebhook({ rawBody: '{}', signature: 'bad' });
    expect(result.status).toBe(400);
  });

  it('records event id and ignores replays', async () => {
    const fakeEvent = { id: 'evt_test_1', type: 'something.unhandled', data: { object: {} } };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => fakeEvent) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const r1 = await handleWebhook({ rawBody: '{}', signature: 'sig1' });
    expect(r1.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1);
    const r2 = await handleWebhook({ rawBody: '{}', signature: 'sig2' });
    expect(r2.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1); // unchanged
  });
});

describe('handlePaymentSucceeded', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedPendingOrder(opts: { promoCode?: string } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'pp-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    let promoId: string | null = null;
    if (opts.promoCode) {
      const promo = await prisma.promoCode.create({
        data: { code: opts.promoCode, discountType: 'PERCENT', discountValue: 10, isActive: true },
      });
      promoId = promo.id;
    }
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        promoCodeId: promoId,
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_succ', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
      include: { payment: true },
    });
    return { order, promoId };
  }

  it('flips Order to NEW + Payment to CAPTURED', async () => {
    const { order } = await seedPendingOrder();
    const fakeEvent = {
      id: 'evt_succ_1', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('NEW');
    expect(o.payment?.status).toBe('CAPTURED');
  });

  it('increments promo.usageCount + creates PromoRedemption', async () => {
    const { order, promoId } = await seedPendingOrder({ promoCode: 'WELCOME10' });
    const fakeEvent = {
      id: 'evt_succ_2', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const promo = await prisma.promoCode.findUniqueOrThrow({ where: { id: promoId! } });
    expect(promo.usageCount).toBe(1);
    const redemption = await prisma.promoRedemption.findFirst({ where: { orderId: order.id } });
    expect(redemption).not.toBeNull();
  });
});

describe('handlePaymentFailed', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  it('flips Order to PAYMENT_FAILED and releases stock', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'pf-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', stock: 2 }] }, // already decremented in real flow
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_fail', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
    });
    const fakeEvent = {
      id: 'evt_fail_1', type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_test_fail' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('PAYMENT_FAILED');
    expect(o.payment?.status).toBe('FAILED');
    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: product.id, size: 'S' } },
    });
    expect(stock.stock).toBe(3); // 2 + released 1
  });
});
