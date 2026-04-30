import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { GET, DELETE } from '../route';

// Mock resolveCart to control which cart is returned
const resolveCartMock = vi.fn();
vi.mock('@/server/cart/resolve', () => ({
  resolveCart: () => resolveCartMock(),
}));

async function seedCart() {
  return prisma.cart.create({
    data: {
      sessionToken: 'test-token-' + Math.random().toString(36).slice(2, 8),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
    include: { items: true },
  });
}

describe('GET /api/cart', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('returns an empty cart snapshot', async () => {
    const cart = await seedCart();
    resolveCartMock.mockResolvedValue(cart);
    const req = new Request('http://localhost/api/cart');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.subtotalCents).toBe(0);
    expect(body.id).toBe(cart.id);
  });

  it('returns cart with items when cart has items', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'test-product',
        name: 'Test Product',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 10000,
        currency: 'GBP',
        sizes: { create: [{ size: 'M', stock: 5 }] },
        images: { create: [{ url: '/img.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await prisma.cart.create({
      data: {
        sessionToken: 'tok-get',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        items: {
          create: [{ productId: product.id, size: 'M', colour: 'Black', quantity: 2, unitPriceCents: 10000 }],
        },
      },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(cart);
    const req = new Request('http://localhost/api/cart');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.subtotalCents).toBe(20000);
  });
});

describe('DELETE /api/cart', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('clears all items and returns empty snapshot', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'del-product',
        name: 'Del Product',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 5000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 3 }] },
        images: { create: [{ url: '/img.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await prisma.cart.create({
      data: {
        sessionToken: 'tok-del',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        items: {
          create: [{ productId: product.id, size: 'S', colour: 'Black', quantity: 1, unitPriceCents: 5000 }],
        },
      },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(cart);
    const req = new Request('http://localhost/api/cart', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.itemCount).toBe(0);
  });
});
