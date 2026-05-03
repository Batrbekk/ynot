import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../db/client';
import { resetDb } from '../../__tests__/helpers/reset-db';
import { createShipmentForOrder, type CarrierServiceDeps } from '../carrier';
import type { LabelStorage } from '../label-storage';
import type {
  CreateShipmentInput,
  CreateShipmentResult,
} from '../../shipping/provider';
import type {
  CreateRmShipmentResult,
  RoyalMailClickDropProvider,
} from '../../shipping/royal-mail-click-drop';
import type { DhlExpressProvider } from '../../shipping/dhl-express';

interface SeedOpts {
  carrier: 'DHL' | 'ROYAL_MAIL';
  destinationCountry?: string;
  alreadyGenerated?: boolean;
}

async function seedShipment(opts: SeedOpts) {
  const product = await prisma.product.create({
    data: {
      slug: 'silk-scarf',
      name: 'Silk Scarf',
      description: 'Lovely scarf',
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
      carrier: opts.carrier,
      shipFirstName: 'Anna',
      shipLastName: 'Schmidt',
      shipLine1: 'Friedrichstrasse 12',
      shipCity: 'Berlin',
      shipPostcode: '10117',
      shipCountry: opts.destinationCountry ?? 'DE',
      shipPhone: '+49 30 1234567',
    },
  });
  const shipment = await prisma.shipment.create({
    data: {
      orderId: order.id,
      carrier: opts.carrier,
      labelGeneratedAt: opts.alreadyGenerated ? new Date() : null,
      trackingNumber: opts.alreadyGenerated ? 'EXISTING-TRK' : null,
      labelStorageKey: opts.alreadyGenerated ? 'existing.pdf' : null,
    },
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
  return { order, shipment, product };
}

function fakeStorage(): LabelStorage & { puts: Array<{ id: string; bytes: Buffer }> } {
  const puts: Array<{ id: string; bytes: Buffer }> = [];
  return {
    puts,
    async put(id, bytes) {
      puts.push({ id, bytes });
      return `${id}.pdf`;
    },
    async get() {
      return Buffer.from('');
    },
    async delete() {},
  };
}

function buildDeps(overrides: Partial<CarrierServiceDeps>): CarrierServiceDeps {
  const dhl = {
    createShipment: vi.fn(),
  } as unknown as DhlExpressProvider;
  const rm = {
    createShipment: vi.fn(),
    getLabel: vi.fn(),
  } as unknown as RoyalMailClickDropProvider;
  return {
    dhl,
    rm,
    storage: fakeStorage(),
    ...overrides,
  };
}

describe('createShipmentForOrder — DHL', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('calls DhlExpressProvider.createShipment, stores label + customs invoice, persists Shipment fields', async () => {
    const { shipment } = await seedShipment({ carrier: 'DHL' });
    const labelBytes = Buffer.from('DHL-LABEL');
    const customsBytes = Buffer.from('DHL-CUSTOMS');
    const dhl = {
      createShipment: vi.fn().mockResolvedValue({
        trackingNumber: 'DHLTRK1',
        labelPdfBytes: labelBytes,
        customsInvoicePdfBytes: customsBytes,
      } satisfies CreateShipmentResult),
    } as unknown as DhlExpressProvider;
    const storage = fakeStorage();
    const deps = buildDeps({ dhl, storage });

    const r = await createShipmentForOrder(shipment.id, deps);

    expect(r.trackingNumber).toBe('DHLTRK1');
    expect(r.labelKey).toBe(`${shipment.id}.pdf`);

    // Both label and customs invoice were persisted.
    expect(storage.puts.map((p) => p.id).sort()).toEqual(
      [shipment.id, `${shipment.id}-customs`].sort(),
    );
    expect(storage.puts.find((p) => p.id === shipment.id)?.bytes.toString()).toBe('DHL-LABEL');
    expect(storage.puts.find((p) => p.id === `${shipment.id}-customs`)?.bytes.toString()).toBe(
      'DHL-CUSTOMS',
    );

    // DHL was given an isInternational=true input (DE != GB) with mapped recipient + items.
    const call = (dhl.createShipment as ReturnType<typeof vi.fn>).mock.calls[0]![0] as CreateShipmentInput;
    expect(call.isInternational).toBe(true);
    expect(call.recipient.countryCode).toBe('DE');
    expect(call.recipient.fullName).toBe('Anna Schmidt');
    expect(call.items).toHaveLength(1);
    expect(call.items[0].sku).toBe('silk-scarf');
    expect(call.items[0].weightGrams).toBe(80);
    expect(call.items[0].hsCode).toBe('6214.10');
    expect(call.weightGrams).toBe(80);

    // Shipment row is updated, ShipmentEvent { status: 'label_created' } inserted.
    const fresh = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(fresh?.trackingNumber).toBe('DHLTRK1');
    expect(fresh?.labelStorageKey).toBe(`${shipment.id}.pdf`);
    expect(fresh?.labelGeneratedAt).toBeInstanceOf(Date);

    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: shipment.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('label_created');
  });

  it('returns existing trackingNumber + labelKey when Shipment.labelGeneratedAt is already set (idempotency)', async () => {
    const { shipment } = await seedShipment({ carrier: 'DHL', alreadyGenerated: true });
    const dhl = {
      createShipment: vi.fn(),
    } as unknown as DhlExpressProvider;
    const deps = buildDeps({ dhl });

    const r = await createShipmentForOrder(shipment.id, deps);
    expect(r.trackingNumber).toBe('EXISTING-TRK');
    expect(r.labelKey).toBe('existing.pdf');
    expect(dhl.createShipment).not.toHaveBeenCalled();
  });

  it('throws when shipment id does not exist', async () => {
    const deps = buildDeps({});
    await expect(createShipmentForOrder('nope', deps)).rejects.toThrow(/not found/i);
  });

  it('marks isInternational=false when destination is GB', async () => {
    const { shipment } = await seedShipment({ carrier: 'DHL', destinationCountry: 'GB' });
    const dhl = {
      createShipment: vi.fn().mockResolvedValue({
        trackingNumber: 'GB1',
        labelPdfBytes: Buffer.from('L'),
      } satisfies CreateShipmentResult),
    } as unknown as DhlExpressProvider;
    const deps = buildDeps({ dhl });

    await createShipmentForOrder(shipment.id, deps);
    const call = (dhl.createShipment as ReturnType<typeof vi.fn>).mock.calls[0]![0] as CreateShipmentInput;
    expect(call.isInternational).toBe(false);
  });
});

describe('createShipmentForOrder — Royal Mail', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('calls RoyalMailClickDropProvider.createShipment + getLabel, persists Shipment fields', async () => {
    const { shipment } = await seedShipment({ carrier: 'ROYAL_MAIL', destinationCountry: 'GB' });
    const labelBytes = Buffer.from('RM-LABEL');
    const rm = {
      createShipment: vi.fn().mockResolvedValue({
        trackingNumber: 'RMTRK1',
        rmOrderId: '99001',
      } satisfies CreateRmShipmentResult),
      getLabel: vi.fn().mockResolvedValue(labelBytes),
    } as unknown as RoyalMailClickDropProvider;
    const storage = fakeStorage();
    const deps = buildDeps({ rm, storage });

    const r = await createShipmentForOrder(shipment.id, deps);

    expect(r.trackingNumber).toBe('RMTRK1');
    expect(r.labelKey).toBe(`${shipment.id}.pdf`);
    expect(rm.getLabel).toHaveBeenCalledWith('99001');
    expect(storage.puts).toHaveLength(1);
    expect(storage.puts[0].bytes.toString()).toBe('RM-LABEL');

    const fresh = await prisma.shipment.findUnique({ where: { id: shipment.id } });
    expect(fresh?.trackingNumber).toBe('RMTRK1');
    expect(fresh?.labelStorageKey).toBe(`${shipment.id}.pdf`);
    expect(fresh?.labelGeneratedAt).toBeInstanceOf(Date);

    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: shipment.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('label_created');
  });
});
