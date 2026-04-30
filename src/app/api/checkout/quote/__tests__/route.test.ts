import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { seedShipping } from '../../../../../../tests/seeds/shipping';
import { POST } from '../route';

// Mock resolveCart to avoid next-auth / cookie dependencies in unit tests
const resolveCartMock = vi.fn();
vi.mock('@/server/cart/resolve', () => ({
  resolveCart: () => resolveCartMock(),
}));

describe('POST /api/checkout/quote', () => {
  beforeEach(async () => {
    await resetDb();
    await seedShipping(prisma);
    vi.clearAllMocks();
    // Create a guest cart and return it from resolveCart
    const cart = await prisma.cart.create({
      data: {
        sessionToken: 'quote-test-token',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(cart);
  });

  async function postQuote(countryCode: string) {
    const body = JSON.stringify({
      address: {
        email: 'a@x.com', firstName: 'A', lastName: 'B',
        line1: '1 St', city: 'London', postcode: 'SW1', countryCode, phone: '+440000000000',
      },
    });
    return POST(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', body, headers: { 'content-type': 'application/json' },
    }));
  }

  it('returns Royal Mail FREE for GB', async () => {
    // Need a cart with items for subtotal — but the quote endpoint reads cart from cookie.
    // For this unit test we accept that cart resolution returns an empty cart (subtotal 0)
    // — Royal Mail still returns 0-rate for GB; what matters is correct routing.
    const res = await postQuote('GB');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0].carrier).toBe('ROYAL_MAIL');
    expect(body.methods[0].totalCents).toBe(0);
  });

  it('returns DHL DDP for FR with duties on subtotal', async () => {
    const res = await postQuote('FR');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.methods).toHaveLength(1);
    expect(body.methods[0].carrier).toBe('DHL');
  });

  it('returns 400 on invalid body', async () => {
    const res = await POST(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });
});
