import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { updateStatus } from '../service';
import { IllegalTransitionError } from '../state-machine';

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
