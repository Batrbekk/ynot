import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { signOrderToken } from '@/server/checkout/order-token';

vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(async () => null),
}));

let _testCookies: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      _testCookies[name] ? { value: _testCookies[name] } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers()),
}));

// Stub the deps factory so the route never touches real RM / disk; record
// what was passed into createReturn for assertion.
const createReturnSpy = vi.fn();
vi.mock('@/server/returns/service', async (orig) => {
  const real = await orig<typeof import('@/server/returns/service')>();
  return {
    ...real,
    createReturn: vi.fn((...args) => {
      createReturnSpy(...args);
      // delegate to real to actually populate DB rows
      return real.createReturn(args[0], args[1]);
    }),
  };
});

vi.mock('@/server/returns/deps', () => ({
  buildReturnsDeps: () => ({
    rm: {
      createReturnLabel: vi.fn(async () => ({
        rmOrderId: 'rm_test',
        labelPdfBytes: Buffer.from('%PDF-1.7-fake'),
      })),
    },
    storage: (() => {
      const store = new Map<string, Buffer>();
      return {
        put: vi.fn(async (id: string, content: Buffer) => {
          const key = `local:${id}`;
          store.set(key, content);
          return key;
        }),
        get: vi.fn(async (key: string) => store.get(key) ?? Buffer.from('')),
        delete: vi.fn(async (key: string) => { store.delete(key); }),
      };
    })(),
    emailService: { send: vi.fn(async () => ({ id: 'em_1' })) },
  }),
}));

import { POST } from '../route';

async function seedDeliveredOrder(opts: { country?: string } = {}) {
  const country = opts.country ?? 'GB';
  const product = await prisma.product.create({
    data: {
      slug: 'rt-' + Math.random().toString(36).slice(2, 6),
      name: 'Tee', priceCents: 5000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: 5 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
  const user = await prisma.user.create({
    data: { email: 'g+' + Math.random().toString(36).slice(2, 6) + '@x.com', isGuest: true },
  });
  return prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      userId: user.id,
      status: 'DELIVERED',
      subtotalCents: 5000, shippingCents: 0, discountCents: 0,
      totalCents: 5000, currency: 'GBP',
      carrier: country === 'GB' ? 'ROYAL_MAIL' : 'DHL',
      shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
      shipCity: 'L', shipPostcode: 'SW1', shipCountry: country, shipPhone: '+44',
      items: {
        create: [{
          productId: product.id, productSlug: product.slug, productName: 'Tee',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 5000, currency: 'GBP', quantity: 1,
        }],
      },
      shipments: {
        create: [{
          carrier: country === 'GB' ? 'ROYAL_MAIL' : 'DHL',
          deliveredAt: new Date(Date.now() - 3 * 86400000),
        }],
      },
    },
    include: { items: true },
  });
}

describe('POST /api/returns', () => {
  beforeEach(async () => {
    _testCookies = {};
    createReturnSpy.mockClear();
    await resetDb();
  });

  it('rejects invalid JSON', async () => {
    const req = new Request('http://localhost/api/returns', {
      method: 'POST', body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_JSON');
  });

  it('rejects body that fails Zod validation', async () => {
    const req = new Request('http://localhost/api/returns', {
      method: 'POST',
      body: JSON.stringify({ orderId: '', items: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_BODY');
  });

  it('returns 404 for unknown order', async () => {
    const req = new Request('http://localhost/api/returns', {
      method: 'POST',
      body: JSON.stringify({
        orderId: 'nope',
        items: [{ orderItemId: 'oi', quantity: 1 }],
        reasonCategory: 'OTHER',
        reason: 'x',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 403 without session or token', async () => {
    const order = await seedDeliveredOrder();
    const req = new Request('http://localhost/api/returns', {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        reasonCategory: 'DOES_NOT_FIT',
        reason: 'too small',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('creates a return when the order-token cookie matches', async () => {
    const order = await seedDeliveredOrder();
    _testCookies['__ynot_order_token'] = signOrderToken(order.id, order.createdAt);
    const req = new Request('http://localhost/api/returns', {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        reasonCategory: 'DOES_NOT_FIT',
        reason: 'too small',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.returnId).toBeTruthy();
    expect(body.returnNumber).toMatch(/^RT-\d{4}-\d{5}$/);
    expect(createReturnSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when service throws (e.g. outside window)', async () => {
    // Create order delivered too long ago
    const product = await prisma.product.create({
      data: {
        slug: 'rt-old', name: 'P', priceCents: 5000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'M', stock: 1 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const user = await prisma.user.create({
      data: { email: 'old@x.com', isGuest: true },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-OLD', userId: user.id, status: 'DELIVERED',
        subtotalCents: 5000, shippingCents: 0, discountCents: 0, totalCents: 5000,
        currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: 'rt-old', productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'M',
          unitPriceCents: 5000, currency: 'GBP', quantity: 1 }] },
        shipments: { create: [{ carrier: 'ROYAL_MAIL',
          deliveredAt: new Date(Date.now() - 30 * 86400000) }] },
      },
      include: { items: true },
    });
    _testCookies['__ynot_order_token'] = signOrderToken(order.id, order.createdAt);
    const req = new Request('http://localhost/api/returns', {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
        reasonCategory: 'DOES_NOT_FIT',
        reason: 'too late',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
