import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../db/client';
import { resetDb } from '../../__tests__/helpers/reset-db';
import { syncShipment } from '../service';
import type { TrackingProvider, TrackingResult } from '../provider';

function fakeProvider(result: TrackingResult): TrackingProvider {
  return { getStatus: vi.fn().mockResolvedValue(result) };
}

async function seedShipment(opts: {
  carrier: 'DHL' | 'ROYAL_MAIL';
  trackingNumber?: string | null;
  deliveredAt?: Date | null;
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `YN-2026-${Math.floor(Math.random() * 9999)
        .toString()
        .padStart(4, '0')}`,
      status: 'PROCESSING',
      subtotalCents: 1000,
      shippingCents: 0,
      totalCents: 1000,
      carrier: opts.carrier,
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
      carrier: opts.carrier,
      trackingNumber:
        opts.trackingNumber === undefined ? 'TRK-1' : opts.trackingNumber,
      deliveredAt: opts.deliveredAt ?? null,
    },
  });
}

describe('TrackingService.syncShipment', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns no-op when shipment lacks a tracking number', async () => {
    const ship = await seedShipment({ carrier: 'DHL', trackingNumber: null });
    const dhl = fakeProvider({ currentStatus: 'IN_TRANSIT', events: [], deliveredAt: null });
    const r = await syncShipment(ship.id, {
      dhl,
      royalMail: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
    });
    expect(r).toEqual({ statusChanged: false, newEvents: 0 });
    expect(dhl.getStatus).not.toHaveBeenCalled();
  });

  it('returns no-op when shipment is already delivered', async () => {
    const ship = await seedShipment({
      carrier: 'DHL',
      trackingNumber: 'TRK',
      deliveredAt: new Date('2026-04-30T00:00:00Z'),
    });
    const dhl = fakeProvider({ currentStatus: 'DELIVERED', events: [], deliveredAt: null });
    const r = await syncShipment(ship.id, {
      dhl,
      royalMail: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
    });
    expect(r).toEqual({ statusChanged: false, newEvents: 0 });
    expect(dhl.getStatus).not.toHaveBeenCalled();
  });

  it('picks DHL provider for DHL carrier and inserts new ShipmentEvent rows', async () => {
    const ship = await seedShipment({ carrier: 'DHL', trackingNumber: 'TRK1' });
    const dhl = fakeProvider({
      currentStatus: 'IN_TRANSIT',
      events: [
        {
          status: 'IN_TRANSIT',
          rawCarrierStatus: 'transit',
          description: 'In transit',
          occurredAt: new Date('2026-05-01T08:00:00Z'),
        },
      ],
      deliveredAt: null,
    });
    const royalMail = fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null });

    const r = await syncShipment(ship.id, { dhl, royalMail });

    expect(dhl.getStatus).toHaveBeenCalledWith('TRK1');
    expect(royalMail.getStatus).not.toHaveBeenCalled();
    expect(r).toEqual({ statusChanged: false, newEvents: 1 });

    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: ship.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('transit');
    expect(events[0].description).toBe('In transit');
  });

  it('picks Royal Mail provider for ROYAL_MAIL carrier', async () => {
    const ship = await seedShipment({ carrier: 'ROYAL_MAIL', trackingNumber: 'RM1' });
    const dhl = fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null });
    const royalMail = fakeProvider({
      currentStatus: 'IN_TRANSIT',
      events: [
        {
          status: 'IN_TRANSIT',
          rawCarrierStatus: 'despatched',
          description: 'Despatched',
          occurredAt: new Date('2026-05-01T11:00:00Z'),
        },
      ],
      deliveredAt: null,
    });

    await syncShipment(ship.id, { dhl, royalMail });
    expect(royalMail.getStatus).toHaveBeenCalledWith('RM1');
    expect(dhl.getStatus).not.toHaveBeenCalled();
  });

  it('dedupes events on (shipmentId, occurredAt, rawCarrierStatus)', async () => {
    const ship = await seedShipment({ carrier: 'DHL', trackingNumber: 'TRK' });
    const occurredAt = new Date('2026-05-01T08:00:00Z');
    // Pre-seed an existing event matching one of the carrier's events.
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: ship.id,
        status: 'transit',
        description: 'Existing',
        occurredAt,
      },
    });

    const dhl = fakeProvider({
      currentStatus: 'IN_TRANSIT',
      events: [
        {
          status: 'IN_TRANSIT',
          rawCarrierStatus: 'transit',
          description: 'In transit (dup)',
          occurredAt,
        },
        {
          status: 'OUT_FOR_DELIVERY',
          rawCarrierStatus: 'out for delivery',
          description: 'Out for delivery',
          occurredAt: new Date('2026-05-02T07:00:00Z'),
        },
      ],
      deliveredAt: null,
    });

    const r = await syncShipment(ship.id, {
      dhl,
      royalMail: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
    });

    expect(r.newEvents).toBe(1);
    const all = await prisma.shipmentEvent.findMany({
      where: { shipmentId: ship.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.status)).toEqual(['transit', 'out for delivery']);
  });

  it('sets Shipment.deliveredAt when the carrier reports delivery', async () => {
    const ship = await seedShipment({ carrier: 'DHL', trackingNumber: 'TRK' });
    const deliveredAt = new Date('2026-05-02T15:30:00Z');
    const dhl = fakeProvider({
      currentStatus: 'DELIVERED',
      events: [
        {
          status: 'DELIVERED',
          rawCarrierStatus: 'delivered',
          description: 'Delivered',
          occurredAt: deliveredAt,
        },
      ],
      deliveredAt,
    });

    const r = await syncShipment(ship.id, {
      dhl,
      royalMail: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
    });
    expect(r.statusChanged).toBe(true);

    const fresh = await prisma.shipment.findUnique({ where: { id: ship.id } });
    expect(fresh?.deliveredAt?.toISOString()).toBe(deliveredAt.toISOString());
  });

  it('returns no-op when shipment id does not exist', async () => {
    const r = await syncShipment('nonexistent', {
      dhl: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
      royalMail: fakeProvider({ currentStatus: 'UNKNOWN', events: [], deliveredAt: null }),
    });
    expect(r).toEqual({ statusChanged: false, newEvents: 0 });
  });
});
