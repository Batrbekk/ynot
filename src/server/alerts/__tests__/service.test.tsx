import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@prisma/client';
import { prisma } from '../../db/client';
import { resetDb } from '../../__tests__/helpers/reset-db';

// Mock the email send pipeline so we never touch the actual transport in
// these tests. The mocks must be declared before importing the module under
// test because vitest hoists `vi.mock` factories.
const sendTemplatedEmailMock = vi.fn();
vi.mock('../../email/send', () => ({
  sendTemplatedEmail: (...args: unknown[]) => sendTemplatedEmailMock(...args),
}));

vi.mock('../../email', () => ({
  getEmailService: vi.fn(() => ({ send: vi.fn() })),
}));

// Pin env to a known ALERT_EMAIL.
vi.mock('../../env', () => ({
  env: {
    ALERT_EMAIL: 'ops@ynotlondon.com',
    NEXT_PUBLIC_SITE_URL: 'https://ynotlondon.com',
  },
}));

import { sendLabelFailureAlert, sendTrackingStaleAlert } from '../service';

async function seedShipment(error: string): Promise<Shipment> {
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-0123',
      status: 'PROCESSING',
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      carrier: 'DHL',
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: '1 St',
      shipCity: 'London',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '+44',
    },
  });
  return prisma.shipment.create({
    data: {
      orderId: order.id,
      carrier: 'DHL',
      attemptCount: 5,
      lastAttemptError: error,
    },
  });
}

describe('AlertService.sendLabelFailureAlert', () => {
  beforeEach(async () => {
    sendTemplatedEmailMock.mockReset().mockResolvedValue({ id: 'email-1' });
    await resetDb();
  });
  afterEach(() => vi.clearAllMocks());

  it('looks up the order and dispatches via sendTemplatedEmail with order #, shipment id, error and admin URL', async () => {
    const shipment = await seedShipment('DHL Express rate API 503: down');

    await sendLabelFailureAlert(shipment);

    expect(sendTemplatedEmailMock).toHaveBeenCalledOnce();
    const args = sendTemplatedEmailMock.mock.calls[0]![0] as {
      to: string;
      subject: string;
      component: { props: Record<string, unknown> };
    };
    expect(args.to).toBe('ops@ynotlondon.com');
    expect(args.subject).toContain('YN-2026-0123');
    expect(args.subject).toMatch(/Label failed/i);
    expect(args.component.props.orderNumber).toBe('YN-2026-0123');
    expect(args.component.props.shipmentId).toBe(shipment.id);
    expect(args.component.props.errorMessage).toContain('503');
    expect(args.component.props.adminUrl).toBe(
      `https://ynotlondon.com/admin/orders/${shipment.orderId}/ship`,
    );
  });

  it('is a no-op when the order has been deleted', async () => {
    const shipment = await seedShipment('boom');
    await prisma.shipment.delete({ where: { id: shipment.id } });
    await prisma.order.delete({ where: { id: shipment.orderId } });

    await sendLabelFailureAlert(shipment);
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });

  it('falls back to "unknown" error text when lastAttemptError is null', async () => {
    const shipment = await seedShipment('placeholder');
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { lastAttemptError: null },
    });
    const fresh = (await prisma.shipment.findUnique({ where: { id: shipment.id } }))!;
    await sendLabelFailureAlert(fresh);
    const args = sendTemplatedEmailMock.mock.calls[0]![0] as {
      component: { props: Record<string, unknown> };
    };
    expect(args.component.props.errorMessage).toBe('unknown');
  });
});

describe('AlertService.sendTrackingStaleAlert', () => {
  beforeEach(() => {
    sendTemplatedEmailMock.mockReset().mockResolvedValue({ id: 'email-2' });
  });

  it('dispatches via sendTemplatedEmail with the affected count and stale-since hours', async () => {
    await sendTrackingStaleAlert(7, 24);
    expect(sendTemplatedEmailMock).toHaveBeenCalledOnce();
    const args = sendTemplatedEmailMock.mock.calls[0]![0] as {
      to: string;
      subject: string;
      component: { props: Record<string, unknown> };
    };
    expect(args.to).toBe('ops@ynotlondon.com');
    expect(args.subject).toContain('Tracking sync stale');
    expect(args.subject).toContain('7');
    expect(args.component.props.affectedCount).toBe(7);
    expect(args.component.props.oldestStaleSinceHours).toBe(24);
    expect(args.component.props.adminUrl).toContain('/admin/orders');
  });
});
