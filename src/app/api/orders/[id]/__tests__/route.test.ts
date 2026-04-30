import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { signOrderToken } from '@/server/checkout/order-token';

// Mock session — order route tests don't test auth flows; session = null (guest)
vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(async () => null),
}));

// Mock next/headers cookies() to read from a global test cookie store
let _testCookies: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => _testCookies[name] ? { value: _testCookies[name] } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers()),
}));

import { GET } from '../route';

describe('GET /api/orders/[id]', () => {
  beforeEach(async () => {
    _testCookies = {};
    await resetDb();
  });

  async function seedGuestOrder() {
    const user = await prisma.user.create({
      data: { email: 'g@x.com', passwordHash: null, isGuest: true },
    });
    const product = await prisma.product.create({
      data: { slug: 'op', name: 'P', priceCents: 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] } },
    });
    return prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001', userId: user.id, status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: 'op', productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
      },
    });
  }

  it('returns order when valid order-token cookie matches', async () => {
    const order = await seedGuestOrder();
    const token = signOrderToken(order.id, order.createdAt);
    _testCookies['__ynot_order_token'] = token;
    const req = new Request(`http://localhost/api/orders/${order.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(order.id);
    expect(body.status).toBe('PENDING_PAYMENT');
  });

  it('returns 403 without auth or token', async () => {
    const order = await seedGuestOrder();
    // _testCookies is empty — no cookie set
    const req = new Request(`http://localhost/api/orders/${order.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: order.id }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent order', async () => {
    const token = signOrderToken('nope', new Date());
    _testCookies['__ynot_order_token'] = token;
    const req = new Request('http://localhost/api/orders/nope');
    const res = await GET(req, { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });
});
