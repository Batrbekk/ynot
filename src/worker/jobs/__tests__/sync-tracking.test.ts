import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackingProvider, TrackingResult } from '@/server/tracking/provider';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { redis as realRedis } from '@/server/redis';
import {
  syncTracking,
  TRACKING_FAILURE_COUNTER_KEY,
  TRACKING_FAILURE_THRESHOLD,
  type RedisLike,
} from '../sync-tracking';

function provider(result: TrackingResult): TrackingProvider {
  return { getStatus: vi.fn().mockResolvedValue(result) };
}

function failingProvider(err = new Error('carrier 503')): TrackingProvider {
  return { getStatus: vi.fn().mockRejectedValue(err) };
}

function fakeRedis() {
  const store = new Map<string, number>();
  const r: RedisLike = {
    async incr(key) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async del(key) {
      const had = store.has(key) ? 1 : 0;
      store.delete(key);
      return had;
    },
  };
  return { redis: r, store };
}

async function seedOrderWithShipment(opts: {
  trackingNumber?: string | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  status?: 'SHIPPED' | 'PARTIALLY_SHIPPED' | 'PARTIALLY_DELIVERED' | 'NEW';
  carrier?: 'DHL' | 'ROYAL_MAIL';
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8),
      status: opts.status ?? 'SHIPPED',
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      carrier: opts.carrier ?? 'ROYAL_MAIL',
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: '1 St',
      shipCity: 'London',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '+44',
    },
  });
  const ship = await prisma.shipment.create({
    data: {
      orderId: order.id,
      carrier: opts.carrier ?? 'ROYAL_MAIL',
      trackingNumber: opts.trackingNumber === undefined ? 'TRK-1' : opts.trackingNumber,
      deliveredAt: opts.deliveredAt ?? null,
      cancelledAt: opts.cancelledAt ?? null,
    },
  });
  return { order, shipment: ship };
}

describe('syncTracking', () => {
  beforeEach(async () => {
    await resetDb();
    await realRedis.del(TRACKING_FAILURE_COUNTER_KEY);
  });

  it('returns zero counts when no shipments need syncing', async () => {
    const r = await syncTracking({
      providers: { dhl: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }), royalMail: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }) },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    expect(r).toEqual({ synced: 0, failed: 0 });
  });

  it('skips shipments without a tracking number, with deliveredAt set, or cancelled', async () => {
    await seedOrderWithShipment({ trackingNumber: null });
    await seedOrderWithShipment({ deliveredAt: new Date() });
    await seedOrderWithShipment({ cancelledAt: new Date() });
    const dhl = provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null });
    const rm = provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null });
    const r = await syncTracking({
      providers: { dhl, royalMail: rm },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    expect(r).toEqual({ synced: 0, failed: 0 });
    expect(dhl.getStatus).not.toHaveBeenCalled();
    expect(rm.getStatus).not.toHaveBeenCalled();
  });

  it('syncs each pending shipment via its carrier provider', async () => {
    await seedOrderWithShipment({ carrier: 'DHL' });
    await seedOrderWithShipment({ carrier: 'ROYAL_MAIL' });
    const dhl = provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null });
    const rm = provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null });
    const r = await syncTracking({
      providers: { dhl, royalMail: rm },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    expect(r.synced).toBe(2);
    expect(r.failed).toBe(0);
    expect(dhl.getStatus).toHaveBeenCalledTimes(1);
    expect(rm.getStatus).toHaveBeenCalledTimes(1);
  });

  it('counts per-shipment failures and continues the loop', async () => {
    await seedOrderWithShipment({ carrier: 'DHL' });
    await seedOrderWithShipment({ carrier: 'DHL' });
    const dhl = {
      getStatus: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
    } as TrackingProvider;
    const r = await syncTracking({
      providers: { dhl, royalMail: failingProvider() },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    expect(r.synced).toBe(1);
    expect(r.failed).toBe(1);
  });

  it('increments Redis counter on total failure but does not alert below threshold', async () => {
    await seedOrderWithShipment({ carrier: 'DHL' });
    const { redis, store } = fakeRedis();
    const alert = vi.fn();
    await syncTracking({
      providers: { dhl: failingProvider(), royalMail: failingProvider() },
      redis,
      sendTrackingStaleAlert: alert,
    });
    expect(store.get(TRACKING_FAILURE_COUNTER_KEY)).toBe(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('fires the alert and resets the counter on the threshold-th total failure', async () => {
    await seedOrderWithShipment({ carrier: 'DHL' });
    const { redis, store } = fakeRedis();
    store.set(TRACKING_FAILURE_COUNTER_KEY, TRACKING_FAILURE_THRESHOLD - 1);
    const alert = vi.fn();
    await syncTracking({
      providers: { dhl: failingProvider(), royalMail: failingProvider() },
      redis,
      sendTrackingStaleAlert: alert,
    });
    expect(alert).toHaveBeenCalledWith(1, TRACKING_FAILURE_THRESHOLD);
    expect(store.has(TRACKING_FAILURE_COUNTER_KEY)).toBe(false);
  });

  it('clears the counter on partial success', async () => {
    await seedOrderWithShipment({ carrier: 'DHL' });
    await seedOrderWithShipment({ carrier: 'DHL' });
    const dhl = {
      getStatus: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
    } as TrackingProvider;
    const { redis, store } = fakeRedis();
    store.set(TRACKING_FAILURE_COUNTER_KEY, 3);
    await syncTracking({
      providers: { dhl, royalMail: failingProvider() },
      redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    expect(store.has(TRACKING_FAILURE_COUNTER_KEY)).toBe(false);
  });

  it('promotes Order to DELIVERED when all active shipments are delivered', async () => {
    const { order, shipment } = await seedOrderWithShipment({
      status: 'SHIPPED',
      carrier: 'DHL',
    });
    // Mark delivered out-of-band so we exercise the reconciler.
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { deliveredAt: new Date() },
    });
    // Note: the reconciler also re-queries — give it a tracking-less seed with
    // `deliveredAt` so the sync loop ignores it but the reconciler picks it up.
    await syncTracking({
      providers: {
        dhl: provider({ currentStatus: 'DELIVERED', events: [], deliveredAt: null }),
        royalMail: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
      },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe('DELIVERED');
  });

  it('promotes Order to PARTIALLY_DELIVERED when some shipments are delivered', async () => {
    const { order } = await seedOrderWithShipment({ status: 'SHIPPED', carrier: 'DHL' });
    // Add a second shipment, delivered.
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: 'DHL',
        trackingNumber: 'TRK-2',
        deliveredAt: new Date(),
      },
    });
    await syncTracking({
      providers: {
        dhl: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
        royalMail: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
      },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe('PARTIALLY_DELIVERED');
  });

  it('ignores cancelled shipments when reconciling order state', async () => {
    const { order, shipment } = await seedOrderWithShipment({ status: 'SHIPPED', carrier: 'DHL' });
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { deliveredAt: new Date() },
    });
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: 'DHL',
        trackingNumber: 'TRK-CANCEL',
        cancelledAt: new Date(),
      },
    });
    await syncTracking({
      providers: {
        dhl: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
        royalMail: provider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null }),
      },
      redis: fakeRedis().redis,
      sendTrackingStaleAlert: vi.fn(),
    });
    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe('DELIVERED');
  });
});
