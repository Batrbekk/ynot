import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { signOrderToken } from '@/server/checkout/order-token';

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

import { POST } from '../route';

describe('POST /api/account/claim', () => {
  beforeEach(async () => {
    _testCookies = {};
    await resetDb();
  });

  async function seedGhostOrder() {
    const user = await prisma.user.create({
      data: { email: 'g@x.com', passwordHash: null, isGuest: true },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001', userId: user.id, status: 'NEW',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
      },
    });
    return { user, order };
  }

  it('promotes ghost user to full account on valid token + password', async () => {
    const { user, order } = await seedGhostOrder();
    const token = signOrderToken(order.id, order.createdAt);
    _testCookies['__ynot_order_token'] = token;
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).not.toBeNull();
    expect(updated.isGuest).toBe(false);
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it('rejects on missing/invalid token', async () => {
    const { order } = await seedGhostOrder();
    // No cookie set
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects 409 if user already has a password', async () => {
    const { user, order } = await seedGhostOrder();
    await prisma.user.update({
      where: { id: user.id }, data: { passwordHash: 'existing', isGuest: false },
    });
    const token = signOrderToken(order.id, order.createdAt);
    _testCookies['__ynot_order_token'] = token;
    const body = JSON.stringify({ orderId: order.id, password: 'reasonably-strong-pass-1' });
    const req = new Request('http://localhost/api/account/claim', {
      method: 'POST', body,
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
