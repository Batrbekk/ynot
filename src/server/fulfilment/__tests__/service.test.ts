import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@prisma/client';
import { prisma } from '../../db/client';
import { resetDb } from '../../__tests__/helpers/reset-db';
import { tryCreateShipment, type TryCreateShipmentDeps } from '../service';
import type { CarrierServiceDeps } from '../carrier';
import type { LabelStorage } from '../label-storage';

async function seedShipment(): Promise<Shipment> {
  const product = await prisma.product.create({
    data: {
      slug: 'silk-scarf',
      name: 'Silk Scarf',
      description: '',
      priceCents: 24000,
      materials: 'Silk',
      care: 'Dry clean',
      sizing: 'One size',
      weightGrams: 80,
      hsCode: '6214.10',
      countryOfOriginCode: 'GB',
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `YN-2026-${Math.floor(Math.random() * 9999)
        .toString()
        .padStart(4, '0')}`,
      status: 'PROCESSING',
      subtotalCents: 24000,
      shippingCents: 0,
      totalCents: 24000,
      carrier: 'DHL',
      shipFirstName: 'Anna',
      shipLastName: 'Schmidt',
      shipLine1: 'Friedrichstrasse 12',
      shipCity: 'Berlin',
      shipPostcode: '10117',
      shipCountry: 'DE',
      shipPhone: '+49',
    },
  });
  const shipment = await prisma.shipment.create({
    data: { orderId: order.id, carrier: 'DHL' },
  });
  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      productSlug: 'silk-scarf',
      productName: 'Silk Scarf',
      productImage: '/x.jpg',
      colour: 'Emerald',
      size: 'M',
      unitPriceCents: 24000,
      quantity: 1,
      shipmentId: shipment.id,
    },
  });
  return shipment;
}

const fakeStorage: LabelStorage = {
  async put(id) {
    return `${id}.pdf`;
  },
  async get() {
    return Buffer.from('');
  },
  async delete() {},
};

function buildDeps(opts: {
  dhlCreate?: ReturnType<typeof vi.fn>;
  alert?: ReturnType<typeof vi.fn>;
}): TryCreateShipmentDeps {
  const carrier: CarrierServiceDeps = {
    dhl: { createShipment: opts.dhlCreate ?? vi.fn() } as never,
    rm: { createShipment: vi.fn(), getLabel: vi.fn() } as never,
    storage: fakeStorage,
  };
  return {
    ...carrier,
    sendLabelFailureAlert:
      (opts.alert as TryCreateShipmentDeps['sendLabelFailureAlert']) ??
      (async () => undefined),
  };
}

describe('tryCreateShipment', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns { ok: true } on success and does not increment attemptCount', async () => {
    const shipment = await seedShipment();
    const dhlCreate = vi.fn().mockResolvedValue({
      trackingNumber: 'TRK',
      labelPdfBytes: Buffer.from('LBL'),
    });
    const alert = vi.fn();
    const deps = buildDeps({ dhlCreate, alert });

    const r = await tryCreateShipment(shipment.id, deps);
    expect(r).toEqual({ ok: true });
    expect(alert).not.toHaveBeenCalled();

    const fresh = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(fresh?.attemptCount).toBe(0);
    expect(fresh?.lastAttemptError).toBeNull();
  });

  it('on failure increments attemptCount, stores lastAttemptError, returns { ok: false, error }', async () => {
    const shipment = await seedShipment();
    const dhlCreate = vi.fn().mockRejectedValue(new Error('DHL Express rate API 503: down'));
    const alert = vi.fn();
    const deps = buildDeps({ dhlCreate, alert });

    const r = await tryCreateShipment(shipment.id, deps);
    expect(r.ok).toBe(false);
    expect(r.gaveUp).toBeUndefined();
    expect(r.error).toContain('503');
    expect(alert).not.toHaveBeenCalled();

    const fresh = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(fresh?.attemptCount).toBe(1);
    expect(fresh?.lastAttemptError).toContain('503');
  });

  it('after the fifth failure calls sendLabelFailureAlert and returns gaveUp:true', async () => {
    const shipment = await seedShipment();
    // Bump attemptCount to 4 so this attempt is the fifth.
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { attemptCount: 4, lastAttemptError: 'previous failure' },
    });
    const dhlCreate = vi.fn().mockRejectedValue(new Error('still down'));
    const alert = vi.fn().mockResolvedValue(undefined);
    const deps = buildDeps({ dhlCreate, alert });

    const r = await tryCreateShipment(shipment.id, deps);
    expect(r.ok).toBe(false);
    expect(r.gaveUp).toBe(true);
    expect(r.error).toBe('still down');

    expect(alert).toHaveBeenCalledOnce();
    const passed = alert.mock.calls[0]![0] as Shipment;
    expect(passed.id).toBe(shipment.id);
    expect(passed.attemptCount).toBe(5);
    expect(passed.lastAttemptError).toBe('still down');
  });

  it('does not throw if sendLabelFailureAlert itself fails — alert errors are swallowed and logged', async () => {
    const shipment = await seedShipment();
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { attemptCount: 4 },
    });
    const dhlCreate = vi.fn().mockRejectedValue(new Error('boom'));
    const alert = vi.fn().mockRejectedValue(new Error('email service down'));
    const deps = buildDeps({ dhlCreate, alert });

    const r = await tryCreateShipment(shipment.id, deps);
    expect(r.gaveUp).toBe(true);
    expect(r.ok).toBe(false);
  });
});
