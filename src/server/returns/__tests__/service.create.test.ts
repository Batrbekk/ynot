import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { createReturn } from '../service';
import type { LabelStorage } from '@/server/fulfilment/label-storage';
import type { EmailService } from '@/server/email';

function inMemoryStorage(): LabelStorage & {
  store: Map<string, Buffer>;
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
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
  return { put, get, delete: del, store } as unknown as LabelStorage & {
    store: Map<string, Buffer>;
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

function fakeEmailService(): EmailService & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async () => ({
    id: 'email_' + Math.random().toString(36).slice(2, 8),
  }));
  return { send } as unknown as EmailService & {
    send: ReturnType<typeof vi.fn>;
  };
}

function fakeRm() {
  return {
    createReturnLabel: vi.fn(async () => ({
      rmOrderId: 'rm_' + Math.random().toString(36).slice(2, 8),
      labelPdfBytes: Buffer.from('%PDF-fake-rm-label'),
    })),
  };
}

interface SeedOpts {
  country?: string;
  deliveredDaysAgo?: number | null;
  qty?: number;
}

async function seedDeliveredOrder(opts: SeedOpts = {}) {
  const country = opts.country ?? 'GB';
  const product = await prisma.product.create({
    data: {
      slug: 'r-' + Math.random().toString(36).slice(2, 6),
      name: 'Tee', priceCents: 5000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      weightGrams: 250, hsCode: '6109', countryOfOriginCode: 'PT',
      sizes: { create: [{ size: 'M', stock: 5 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `c-${Math.random().toString(36).slice(2, 6)}@x.com`,
      name: 'Customer', isGuest: false,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'DELIVERED',
      subtotalCents: 5000, shippingCents: 0, discountCents: 0,
      totalCents: 5000, currency: 'GBP',
      carrier: country === 'GB' ? 'ROYAL_MAIL' : 'DHL',
      shipFirstName: 'Alice', shipLastName: 'Smith', shipLine1: '1 High St',
      shipCity: 'London', shipPostcode: 'SW1', shipCountry: country,
      shipPhone: '+44',
      userId: user.id,
      items: {
        create: [{
          productId: product.id, productSlug: product.slug, productName: 'Tee',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 5000, currency: 'GBP', quantity: opts.qty ?? 1,
        }],
      },
      shipments: {
        create: [{
          carrier: country === 'GB' ? 'ROYAL_MAIL' : 'DHL',
          deliveredAt:
            opts.deliveredDaysAgo === null
              ? null
              : new Date(Date.now() - (opts.deliveredDaysAgo ?? 3) * 86400000),
        }],
      },
    },
    include: { items: true, shipments: true, user: true },
  });
  return { order, product, user };
}

describe('createReturn — UK prepaid path', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates Return + ReturnItems, calls RM, stores label, persists key, sends email with PDF attached', async () => {
    const { order } = await seedDeliveredOrder({ country: 'GB' });
    const storage = inMemoryStorage();
    const rm = fakeRm();
    const emailService = fakeEmailService();

    const ret = await createReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        reasonCategory: 'DOES_NOT_FIT',
        reason: 'Slightly small',
      },
      { rm, storage, emailService },
    );

    expect(ret.returnNumber).toMatch(/^RT-\d{4}-\d{5}$/);
    expect(ret.status).toBe('AWAITING_PARCEL');
    expect(ret.returnLabelKey).toBeTruthy();
    expect(ret.customsPdfKey).toBeNull();

    const items = await prisma.returnItem.findMany({ where: { returnId: ret.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);

    expect(rm.createReturnLabel).toHaveBeenCalledTimes(1);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(emailService.send).toHaveBeenCalledTimes(1);

    const email = emailService.send.mock.calls[0][0];
    expect(email.to).toBe(order.user!.email);
    expect(email.subject).toContain(ret.returnNumber);
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].filename).toContain(ret.returnNumber);
    expect(email.attachments[0].content.toString()).toContain('%PDF');
  });
});

describe('createReturn — international customs path', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders customs PDF, persists customsPdfKey, sends international email with attachment', async () => {
    const { order } = await seedDeliveredOrder({ country: 'DE' });
    const storage = inMemoryStorage();
    const rm = fakeRm();
    const emailService = fakeEmailService();

    const ret = await createReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        reasonCategory: 'CHANGED_MIND',
        reason: 'Changed my mind',
      },
      { rm, storage, emailService },
    );

    expect(ret.customsPdfKey).toBeTruthy();
    expect(ret.returnLabelKey).toBeNull();
    expect(rm.createReturnLabel).not.toHaveBeenCalled();
    expect(storage.put).toHaveBeenCalledTimes(1);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const email = emailService.send.mock.calls[0][0];
    expect(email.subject).toContain(ret.returnNumber);
    expect(email.attachments[0].filename).toMatch(/customs-/);
    expect(email.attachments[0].content.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('createReturn — validation', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects orders outside the 14-day window', async () => {
    const { order } = await seedDeliveredOrder({ deliveredDaysAgo: 30 });
    await expect(
      createReturn(
        {
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, quantity: 1 }],
          reasonCategory: 'DOES_NOT_FIT',
          reason: 'x',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/window/i);
  });

  it('rejects items that do not belong to the order', async () => {
    const { order } = await seedDeliveredOrder();
    await expect(
      createReturn(
        {
          orderId: order.id,
          items: [{ orderItemId: 'not-in-order', quantity: 1 }],
          reasonCategory: 'DOES_NOT_FIT',
          reason: 'x',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/does not belong/);
  });

  it('rejects qty exceeding ordered amount', async () => {
    const { order } = await seedDeliveredOrder({ qty: 2 });
    await expect(
      createReturn(
        {
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, quantity: 5 }],
          reasonCategory: 'DOES_NOT_FIT',
          reason: 'x',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/exceeds/i);
  });

  it('rejects qty when an overlapping pending Return locks remaining', async () => {
    const { order } = await seedDeliveredOrder({ qty: 2 });
    // First return claims qty=2 → no remaining.
    await createReturn(
      {
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 2 }],
        reasonCategory: 'DOES_NOT_FIT',
        reason: 'first',
      },
      { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
    );
    await expect(
      createReturn(
        {
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, quantity: 1 }],
          reasonCategory: 'DOES_NOT_FIT',
          reason: 'second',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/exceeds remaining/);
  });

  it('rejects empty items array', async () => {
    const { order } = await seedDeliveredOrder();
    await expect(
      createReturn(
        {
          orderId: order.id,
          items: [],
          reasonCategory: 'OTHER',
          reason: 'x',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/at least one/i);
  });

  it('throws when the order does not exist', async () => {
    await expect(
      createReturn(
        {
          orderId: 'nope',
          items: [{ orderItemId: 'oi', quantity: 1 }],
          reasonCategory: 'OTHER',
          reason: 'x',
        },
        { rm: fakeRm(), storage: inMemoryStorage(), emailService: fakeEmailService() },
      ),
    ).rejects.toThrow(/not found/);
  });
});
