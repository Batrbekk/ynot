import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';

describe('refundFull', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedDeliveredOrder(opts: {
    refundedSoFar?: number;
    paymentStatus?: 'CAPTURED' | 'PENDING' | 'REFUNDED';
    status?: 'DELIVERED' | 'RETURNED' | 'CANCELLED' | 'SHIPPED';
  } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'rf-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 5000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'M', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    return prisma.order.create({
      data: {
        orderNumber: 'YN-2026-RF' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        status: opts.status ?? 'DELIVERED',
        subtotalCents: 5000, shippingCents: 0, discountCents: 0,
        totalCents: 5000, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: {
          create: [{
            productId: product.id, productSlug: product.slug, productName: 'P',
            productImage: '/x.jpg', colour: 'Black', size: 'M',
            unitPriceCents: 5000, currency: 'GBP', quantity: 1,
          }],
        },
        payment: {
          create: {
            stripePaymentIntentId: 'pi_test_' + Math.random().toString(36).slice(2, 8),
            status: opts.paymentStatus ?? 'CAPTURED',
            amountCents: 5000, currency: 'GBP',
            refundedAmountCents: opts.refundedSoFar ?? 0,
          },
        },
      },
      include: { payment: true },
    });
  }

  it('calls Stripe with remaining amount, inserts RefundEvent, marks Payment REFUNDED, transitions Order to RETURNED', async () => {
    const create = vi.fn(async () => ({ id: 're_full_1' }));
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundFull } = await import('../service');

    const order = await seedDeliveredOrder();
    const result = await refundFull(order.id, 'admin_cancel');

    expect(result.refundId).toBe('re_full_1');
    expect(result.amountCents).toBe(5000);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      payment_intent: order.payment!.stripePaymentIntentId,
      amount: 5000,
      metadata: { orderId: order.id, reason: 'admin_cancel' },
    });

    const events = await prisma.refundEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].stripeRefundId).toBe('re_full_1');
    expect(events[0].amountCents).toBe(5000);
    expect(events[0].reason).toBe('admin_cancel');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.refundedAmountCents).toBe(5000);
    expect(payment.status).toBe('REFUNDED');

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('RETURNED');
  });

  it('refunds only the remaining amount when partial refund already applied', async () => {
    const create = vi.fn(async () => ({ id: 're_full_2' }));
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundFull } = await import('../service');

    const order = await seedDeliveredOrder({ refundedSoFar: 2000 });
    const result = await refundFull(order.id, 'remaining');

    expect(result.amountCents).toBe(3000);
    expect(create.mock.calls[0][0].amount).toBe(3000);
  });

  it('skips status transition when order is already CANCELLED', async () => {
    const create = vi.fn(async () => ({ id: 're_canc' }));
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundFull } = await import('../service');

    const order = await seedDeliveredOrder({ status: 'CANCELLED' });
    await refundFull(order.id, 'cancel');

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('CANCELLED'); // unchanged
    const events = await prisma.orderStatusEvent.count({ where: { orderId: order.id } });
    expect(events).toBe(0);
  });

  it('throws when order has no payment intent', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundFull } = await import('../service');

    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-NOPI-' + Math.random().toString(36).slice(2, 6),
        status: 'DELIVERED',
        subtotalCents: 100, shippingCents: 0, discountCents: 0,
        totalCents: 100, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      },
    });
    await expect(refundFull(order.id, 'x')).rejects.toThrow(/payment intent/);
  });

  it('throws when payment is not captured', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundFull } = await import('../service');
    const order = await seedDeliveredOrder({ paymentStatus: 'PENDING' });
    await expect(refundFull(order.id, 'x')).rejects.toThrow(/PENDING/);
  });

  it('throws when already fully refunded', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundFull } = await import('../service');
    // Payment still CAPTURED but refundedAmountCents already at full — the
    // `remaining <= 0` guard fires before any Stripe call.
    const order = await seedDeliveredOrder({ refundedSoFar: 5000 });
    await expect(refundFull(order.id, 'x')).rejects.toThrow(/already fully refunded/);
  });

  it('throws on missing order', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundFull } = await import('../service');
    await expect(refundFull('nope', 'x')).rejects.toThrow(/not found/);
  });
});
