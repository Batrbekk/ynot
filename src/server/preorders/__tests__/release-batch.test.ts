import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { releaseBatchForShipping } from '../service';
import type { TryCreateShipmentDeps } from '@/server/fulfilment/service';

function fakeShipmentDeps(): TryCreateShipmentDeps {
  return {
    dhl: { createShipment: vi.fn() } as unknown as TryCreateShipmentDeps['dhl'],
    rm: {
      createShipment: vi.fn(),
      getLabel: vi.fn(),
    } as unknown as TryCreateShipmentDeps['rm'],
    storage: {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    } as unknown as TryCreateShipmentDeps['storage'],
    sendLabelFailureAlert: vi.fn(),
  };
}

async function seedBatchWithOrders(opts: { batchStatus?: 'PENDING' | 'IN_PRODUCTION' } = {}) {
  const product = await prisma.product.create({
    data: {
      slug: 'pre-' + Math.random().toString(36).slice(2, 6),
      name: 'P', priceCents: 7000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: 0 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const batch = await prisma.preorderBatch.create({
    data: {
      name: 'AW26',
      productId: product.id,
      status: opts.batchStatus ?? 'IN_PRODUCTION',
      estimatedShipFrom: new Date('2026-09-01'),
      estimatedShipTo: new Date('2026-09-15'),
    },
  });
  // Order with one preorder item attached to a Shipment
  const orderA = await prisma.order.create({
    data: {
      orderNumber: 'YN-PRE-A-' + Math.random().toString(36).slice(2, 6),
      status: 'PROCESSING',
      subtotalCents: 7000, shippingCents: 0, discountCents: 0,
      totalCents: 7000, currency: 'GBP', carrier: 'ROYAL_MAIL',
      shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
      shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      shipments: { create: [{ carrier: 'ROYAL_MAIL' }] },
    },
    include: { shipments: true },
  });
  await prisma.orderItem.create({
    data: {
      orderId: orderA.id, productId: product.id, productSlug: product.slug,
      productName: 'P', productImage: '/x.jpg', colour: 'Black', size: 'M',
      unitPriceCents: 7000, currency: 'GBP', quantity: 1,
      isPreorder: true, preorderBatchId: batch.id,
      shipmentId: orderA.shipments[0].id,
    },
  });
  // Second order, distinct shipment
  const orderB = await prisma.order.create({
    data: {
      orderNumber: 'YN-PRE-B-' + Math.random().toString(36).slice(2, 6),
      status: 'PROCESSING',
      subtotalCents: 7000, shippingCents: 0, discountCents: 0,
      totalCents: 7000, currency: 'GBP', carrier: 'ROYAL_MAIL',
      shipFirstName: 'C', shipLastName: 'D', shipLine1: '1',
      shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      shipments: { create: [{ carrier: 'ROYAL_MAIL' }] },
    },
    include: { shipments: true },
  });
  await prisma.orderItem.create({
    data: {
      orderId: orderB.id, productId: product.id, productSlug: product.slug,
      productName: 'P', productImage: '/x.jpg', colour: 'Black', size: 'M',
      unitPriceCents: 7000, currency: 'GBP', quantity: 1,
      isPreorder: true, preorderBatchId: batch.id,
      shipmentId: orderB.shipments[0].id,
    },
  });
  return { batch, orderA, orderB, product };
}

describe('releaseBatchForShipping', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('marks batch SHIPPING and calls tryCreateShipment per unique Shipment', async () => {
    const { batch, orderA, orderB } = await seedBatchWithOrders();
    const tryCreateShipment = vi.fn(async (shipmentId: string) => ({
      ok: true,
    }));
    const shipmentDeps = fakeShipmentDeps();

    const result = await releaseBatchForShipping(batch.id, {
      tryCreateShipment,
      shipmentDeps,
    });

    expect(result.shipmentIds).toHaveLength(2);
    expect(new Set(result.shipmentIds)).toEqual(
      new Set([orderA.shipments[0].id, orderB.shipments[0].id]),
    );
    expect(tryCreateShipment).toHaveBeenCalledTimes(2);
    for (const call of tryCreateShipment.mock.calls) {
      expect(result.shipmentIds).toContain(call[0]);
    }

    const updated = await prisma.preorderBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(updated.status).toBe('SHIPPING');
  });

  it('captures per-shipment failures without throwing', async () => {
    const { batch, orderA } = await seedBatchWithOrders();
    const tryCreateShipment = vi.fn(async (shipmentId: string) =>
      shipmentId === orderA.shipments[0].id
        ? { ok: false, error: 'carrier 503' }
        : { ok: true },
    );

    const result = await releaseBatchForShipping(batch.id, {
      tryCreateShipment, shipmentDeps: fakeShipmentDeps(),
    });

    const failed = result.results.find(
      (r) => r.shipmentId === orderA.shipments[0].id,
    );
    expect(failed?.result.ok).toBe(false);
    expect(failed?.result.error).toBe('carrier 503');
  });

  it('returns empty shipmentIds + still flips status when batch has no items', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'empty-pre-' + Math.random().toString(36).slice(2, 5),
        name: 'P', priceCents: 1000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'M', stock: 0 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const batch = await prisma.preorderBatch.create({
      data: {
        name: 'empty', productId: product.id, status: 'PENDING',
        estimatedShipFrom: new Date('2026-09-01'),
        estimatedShipTo: new Date('2026-09-15'),
      },
    });
    const tryCreateShipment = vi.fn();
    const result = await releaseBatchForShipping(batch.id, {
      tryCreateShipment, shipmentDeps: fakeShipmentDeps(),
    });
    expect(result.shipmentIds).toEqual([]);
    expect(tryCreateShipment).not.toHaveBeenCalled();
    const updated = await prisma.preorderBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(updated.status).toBe('SHIPPING');
  });

  it('throws on missing batch', async () => {
    await expect(
      releaseBatchForShipping('nope', {
        tryCreateShipment: vi.fn(), shipmentDeps: fakeShipmentDeps(),
      }),
    ).rejects.toThrow(/not found/);
  });

  it('throws on already-COMPLETED batch', async () => {
    const { batch } = await seedBatchWithOrders();
    await prisma.preorderBatch.update({
      where: { id: batch.id }, data: { status: 'COMPLETED' },
    });
    await expect(
      releaseBatchForShipping(batch.id, {
        tryCreateShipment: vi.fn(), shipmentDeps: fakeShipmentDeps(),
      }),
    ).rejects.toThrow(/COMPLETED/);
  });
});
