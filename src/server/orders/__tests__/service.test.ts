import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { cancelOrder, updateStatus } from '../service';
import { IllegalTransitionError } from '../state-machine';
import type { EmailService } from '@/server/email';

async function seedOrder(opts: { status?: 'NEW' | 'PROCESSING' | 'DELIVERED' } = {}) {
  return prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8).padStart(5, '0'),
      status: opts.status ?? 'NEW',
      subtotalCents: 10000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 10000,
      currency: 'GBP',
      carrier: 'ROYAL_MAIL',
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: '1',
      shipCity: 'L',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '+44',
    },
  });
}

describe('OrderService.updateStatus', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('transitions NEW → PROCESSING and writes an OrderStatusEvent', async () => {
    const order = await seedOrder({ status: 'NEW' });
    await updateStatus(order.id, 'PROCESSING');
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('PROCESSING');
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('PROCESSING');
    expect(events[0].note).toBeNull();
  });

  it('persists the optional note on the event row', async () => {
    const order = await seedOrder({ status: 'NEW' });
    await updateStatus(order.id, 'PROCESSING', 'shipment label generated');
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events[0].note).toBe('shipment label generated');
  });

  it('throws IllegalTransitionError for NEW → DELIVERED', async () => {
    const order = await seedOrder({ status: 'NEW' });
    await expect(updateStatus(order.id, 'DELIVERED')).rejects.toThrow(IllegalTransitionError);
    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('NEW');
    const events = await prisma.orderStatusEvent.count({ where: { orderId: order.id } });
    expect(events).toBe(0);
  });

  it('is a no-op (no event) when from === to', async () => {
    const order = await seedOrder({ status: 'PROCESSING' });
    await updateStatus(order.id, 'PROCESSING');
    const events = await prisma.orderStatusEvent.count({ where: { orderId: order.id } });
    expect(events).toBe(0);
  });

  it('throws when the order does not exist', async () => {
    await expect(updateStatus('does-not-exist', 'PROCESSING')).rejects.toThrow();
  });
});

function fakeEmailService(): EmailService & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async () => ({ id: 'email_' + Math.random().toString(36).slice(2, 8) }));
  return { send } as unknown as EmailService & { send: ReturnType<typeof vi.fn> };
}

async function seedOrderWithProductAndShipment(opts: {
  status?: 'NEW' | 'PROCESSING' | 'PARTIALLY_SHIPPED' | 'DELIVERED' | 'SHIPPED';
  paymentStatus?: 'PENDING' | 'CAPTURED' | 'REFUNDED';
  shippedAt?: Date | null;
  initialStock?: number;
  qty?: number;
  userEmail?: string | null;
} = {}) {
  const product = await prisma.product.create({
    data: {
      slug: 'cancel-' + Math.random().toString(36).slice(2, 6),
      name: 'P', priceCents: 5000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: opts.initialStock ?? 4 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  let userId: string | null = null;
  if (opts.userEmail !== null) {
    const user = await prisma.user.create({
      data: {
        email: opts.userEmail ?? `c-${Math.random().toString(36).slice(2, 6)}@x.com`,
        name: 'Customer', isGuest: true,
      },
    });
    userId = user.id;
  }
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8).padStart(5, '0'),
      status: opts.status ?? 'PROCESSING',
      subtotalCents: 5000, shippingCents: 0, discountCents: 0, totalCents: 5000, currency: 'GBP',
      carrier: 'ROYAL_MAIL', shipFirstName: 'Alice', shipLastName: 'B', shipLine1: '1',
      shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      userId,
      items: {
        create: [{
          productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 5000, currency: 'GBP', quantity: opts.qty ?? 1,
        }],
      },
      payment: {
        create: {
          status: opts.paymentStatus ?? 'CAPTURED',
          amountCents: 5000, currency: 'GBP',
          stripePaymentIntentId: 'pi_cancel_' + Math.random().toString(36).slice(2, 8),
        },
      },
      shipments: {
        create: [{ carrier: 'ROYAL_MAIL', shippedAt: opts.shippedAt ?? null }],
      },
    },
    include: { items: true, shipments: true },
  });
  return { order, product };
}

describe('OrderService.cancelOrder', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('transitions to CANCELLED, marks un-shipped Shipments cancelledAt, restocks, refunds, emails', async () => {
    const refundFull = vi.fn(async () => undefined);
    const emailService = fakeEmailService();
    const { order, product } = await seedOrderWithProductAndShipment({
      initialStock: 4, qty: 1,
    });

    await cancelOrder(order.id, 'customer requested', 'admin-1', {
      refundFull, emailService,
    });

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { shipments: true, events: true },
    });
    expect(updated.status).toBe('CANCELLED');
    expect(updated.shipments.every((s) => s.cancelledAt !== null)).toBe(true);
    expect(updated.events.some((e) => e.status === 'CANCELLED')).toBe(true);
    const event = updated.events.find((e) => e.status === 'CANCELLED');
    expect(event?.note).toContain('admin-1');
    expect(event?.note).toContain('customer requested');

    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: product.id, size: 'M' } },
    });
    expect(stock.stock).toBe(5); // 4 + 1 restocked

    expect(refundFull).toHaveBeenCalledWith(order.id, 'admin_cancel');
    expect(emailService.send).toHaveBeenCalledTimes(1);
    const sent = emailService.send.mock.calls[0][0];
    expect(sent.to).toMatch(/@/);
    expect(sent.subject).toContain(order.orderNumber);
  });

  it('does not call refundFull when payment was never captured', async () => {
    const refundFull = vi.fn(async () => undefined);
    const emailService = fakeEmailService();
    const { order } = await seedOrderWithProductAndShipment({
      paymentStatus: 'PENDING',
    });

    await cancelOrder(order.id, 'never paid', 'admin-1', { refundFull, emailService });
    expect(refundFull).not.toHaveBeenCalled();
  });

  it('does not mark already-shipped Shipments cancelled', async () => {
    const emailService = fakeEmailService();
    const { order } = await seedOrderWithProductAndShipment({
      status: 'PARTIALLY_SHIPPED',
      shippedAt: new Date(),
    });
    await cancelOrder(order.id, 'mistake', 'admin-1', {
      refundFull: vi.fn(async () => undefined), emailService,
    });
    const shipments = await prisma.shipment.findMany({ where: { orderId: order.id } });
    expect(shipments[0].cancelledAt).toBeNull();
  });

  it('skips email when the order has no associated user', async () => {
    const emailService = fakeEmailService();
    const { order } = await seedOrderWithProductAndShipment({ userEmail: null });
    await cancelOrder(order.id, 'guest', 'admin-1', {
      refundFull: vi.fn(async () => undefined), emailService,
    });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('throws when the order is already SHIPPED', async () => {
    const { order } = await seedOrderWithProductAndShipment({
      status: 'SHIPPED',
      shippedAt: new Date(),
    });
    await expect(
      cancelOrder(order.id, 'too late', 'admin-1', {
        refundFull: vi.fn(async () => undefined),
        emailService: fakeEmailService(),
      }),
    ).rejects.toThrow(/Cannot cancel/);
  });
});
