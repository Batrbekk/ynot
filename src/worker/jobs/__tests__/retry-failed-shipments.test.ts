import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import type { LabelStorage } from '@/server/fulfilment/label-storage';
import type { TryCreateShipmentDeps } from '@/server/fulfilment/service';
import { retryFailedShipments } from '../retry-failed-shipments';

const fakeStorage: LabelStorage = {
  put: async () => 'k',
  get: async () => Buffer.from(''),
  delete: async () => {},
};

function buildDeps(opts: { tryCreate?: ReturnType<typeof vi.fn> } = {}) {
  const deps = {
    dhl: { createShipment: vi.fn() } as never,
    rm: { createShipment: vi.fn(), getLabel: vi.fn() } as never,
    storage: fakeStorage,
    sendLabelFailureAlert: vi.fn(),
    tryCreateShipment: opts.tryCreate ?? vi.fn().mockResolvedValue({ ok: true }),
  } satisfies TryCreateShipmentDeps & { tryCreateShipment: ReturnType<typeof vi.fn> };
  return deps;
}

async function seedShipment(opts: {
  attemptCount: number;
  updatedAt?: Date;
  labelGeneratedAt?: Date | null;
  cancelledAt?: Date | null;
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8),
      status: 'PROCESSING',
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      carrier: 'ROYAL_MAIL',
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
      carrier: 'ROYAL_MAIL',
      attemptCount: opts.attemptCount,
      labelGeneratedAt: opts.labelGeneratedAt ?? null,
      cancelledAt: opts.cancelledAt ?? null,
    },
  });
  if (opts.updatedAt) {
    await prisma.shipment.update({
      where: { id: ship.id },
      data: { updatedAt: opts.updatedAt },
    });
  }
  return ship;
}

describe('retryFailedShipments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zero when no shipments need retry', async () => {
    const deps = buildDeps();
    const r = await retryFailedShipments(deps);
    expect(r).toEqual({ retried: 0, skipped: 0 });
    expect(deps.tryCreateShipment).not.toHaveBeenCalled();
  });

  it('skips shipments with attemptCount = 0 (never attempted)', async () => {
    await seedShipment({ attemptCount: 0 });
    const deps = buildDeps();
    const r = await retryFailedShipments(deps);
    expect(r.retried).toBe(0);
    expect(deps.tryCreateShipment).not.toHaveBeenCalled();
  });

  it('skips shipments already labelled', async () => {
    await seedShipment({ attemptCount: 2, labelGeneratedAt: new Date() });
    const deps = buildDeps();
    await retryFailedShipments(deps);
    expect(deps.tryCreateShipment).not.toHaveBeenCalled();
  });

  it('skips cancelled shipments', async () => {
    await seedShipment({ attemptCount: 2, cancelledAt: new Date() });
    const deps = buildDeps();
    await retryFailedShipments(deps);
    expect(deps.tryCreateShipment).not.toHaveBeenCalled();
  });

  it('skips when the backoff window has not elapsed', async () => {
    // attemptCount=1 -> backoff=60_000 ms; updatedAt=now means window pending.
    await seedShipment({ attemptCount: 1, updatedAt: new Date() });
    const deps = buildDeps();
    const r = await retryFailedShipments(deps);
    expect(r.retried).toBe(0);
    expect(r.skipped).toBe(1);
    expect(deps.tryCreateShipment).not.toHaveBeenCalled();
  });

  it('retries when the backoff window has elapsed', async () => {
    // attemptCount=1 -> backoff=60_000 ms; push updatedAt back 5 minutes.
    const ship = await seedShipment({
      attemptCount: 1,
      updatedAt: new Date(Date.now() - 5 * 60_000),
    });
    const deps = buildDeps();
    const r = await retryFailedShipments(deps);
    expect(r.retried).toBe(1);
    expect(deps.tryCreateShipment).toHaveBeenCalledWith(ship.id, deps);
  });

  it('skips shipments past the retry-schedule end', async () => {
    // SCHEDULE_MS has 5 entries -> nextRetryDelayMs(6) === null.
    await seedShipment({
      attemptCount: 6,
      updatedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    });
    const deps = buildDeps();
    const r = await retryFailedShipments(deps);
    expect(r.retried).toBe(0);
  });
});
