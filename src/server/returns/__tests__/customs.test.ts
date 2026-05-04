import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { buildAndStoreCustomsDeclaration, RETURN_ADDRESS } from '../customs';
import type { LabelStorage } from '@/server/fulfilment/label-storage';

function inMemoryStorage(): LabelStorage & {
  store: Map<string, Buffer>;
  put: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, Buffer>();
  const put = vi.fn(async (id: string, content: Buffer) => {
    const key = `local:${id}`;
    store.set(key, content);
    return key;
  });
  const get = vi.fn(async (key: string) => {
    const v = store.get(key);
    if (!v) throw new Error(`miss: ${key}`);
    return v;
  });
  const del = vi.fn(async (key: string) => {
    store.delete(key);
  });
  return { put, get, delete: del, store } as LabelStorage & {
    store: Map<string, Buffer>;
    put: ReturnType<typeof vi.fn>;
  };
}

async function seedDeReturnRow() {
  const product = await prisma.product.create({
    data: {
      slug: 'cust-' + Math.random().toString(36).slice(2, 6),
      name: 'Tee', priceCents: 4500, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      weightGrams: 320, hsCode: '6109',
      countryOfOriginCode: 'PT',
      sizes: { create: [{ size: 'M', stock: 3 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-CUST-' + Math.random().toString(36).slice(2, 6),
      status: 'DELIVERED',
      subtotalCents: 4500, shippingCents: 0, discountCents: 0,
      totalCents: 4500, currency: 'GBP', carrier: 'DHL',
      shipFirstName: 'Hans', shipLastName: 'Müller', shipLine1: 'Bahnhofstr 1',
      shipCity: 'Berlin', shipPostcode: '10115', shipCountry: 'DE',
      shipPhone: '+49',
      items: {
        create: [{
          productId: product.id, productSlug: product.slug, productName: 'Tee',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 4500, currency: 'GBP', quantity: 1,
        }],
      },
    },
    include: { items: true },
  });
  const ret = await prisma.return.create({
    data: {
      orderId: order.id,
      returnNumber: 'RT-2026-T0001',
      reason: 'doesnt fit',
      reasonCategory: 'DOES_NOT_FIT',
      status: 'AWAITING_PARCEL',
      items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] },
    },
  });
  return { order, product, ret };
}

describe('buildAndStoreCustomsDeclaration', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders CN23 PDF, stores via LabelStorage, persists customsPdfKey', async () => {
    const storage = inMemoryStorage();
    const { ret } = await seedDeReturnRow();

    const key = await buildAndStoreCustomsDeclaration(ret.id, { storage });

    expect(key).toMatch(/return-.*-customs/);
    expect(storage.put).toHaveBeenCalledTimes(1);
    const stored = storage.store.get(key);
    expect(stored).toBeDefined();
    expect(stored!.length).toBeGreaterThan(0);
    // PDF magic header
    expect(stored!.slice(0, 4).toString()).toBe('%PDF');

    const updated = await prisma.return.findUniqueOrThrow({
      where: { id: ret.id },
    });
    expect(updated.customsPdfKey).toBe(key);
  });

  it('throws when the return does not exist', async () => {
    const storage = inMemoryStorage();
    await expect(
      buildAndStoreCustomsDeclaration('nope', { storage }),
    ).rejects.toThrow(/not found/i);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('exposes the YNOT London returns address constant', () => {
    expect(RETURN_ADDRESS.country).toBe('GB');
    expect(RETURN_ADDRESS.postcode).toBe('SW7 5QG');
  });
});
