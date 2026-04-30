import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { POST } from '../route';
import Stripe from 'stripe';
import { env } from '@/server/env';

describe('webhook flow (signed payload)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  /**
   * Build a properly-signed Stripe webhook payload using the same secret the
   * server expects (env.STRIPE_WEBHOOK_SECRET — populated from .env.test).
   * We use Stripe's `webhooks.generateTestHeaderString` helper so the HMAC
   * matches what the route's `constructEvent` call will verify.
   */
  function signEvent(event: object, secret: string): { rawBody: string; signature: string } {
    const rawBody = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: rawBody,
      secret,
      timestamp: Math.floor(Date.now() / 1000),
    });
    return { rawBody, signature };
  }

  it('payment_intent.succeeded → flips Order(PENDING_PAYMENT) → NEW', async () => {
    // Seed Order in PENDING_PAYMENT.
    const product = await prisma.product.create({
      data: {
        slug: 'wf',
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 20000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const user = await prisma.user.create({ data: { email: 'g@x.com', passwordHash: null, isGuest: true } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        userId: user.id,
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000,
        shippingCents: 0,
        discountCents: 0,
        totalCents: 20000,
        currency: 'GBP',
        carrier: 'ROYAL_MAIL',
        shipFirstName: 'A',
        shipLastName: 'B',
        shipLine1: '1',
        shipCity: 'L',
        shipPostcode: 'SW1',
        shipCountry: 'GB',
        shipPhone: '+44',
        items: {
          create: [
            {
              productId: product.id,
              productSlug: 'wf',
              productName: 'P',
              productImage: '/x.jpg',
              colour: 'Black',
              size: 'S',
              unitPriceCents: 20000,
              currency: 'GBP',
              quantity: 1,
            },
          ],
        },
        payment: {
          create: {
            stripePaymentIntentId: 'pi_test_real',
            status: 'PENDING',
            amountCents: 20000,
            currency: 'GBP',
          },
        },
      },
    });

    const event = {
      id: 'evt_real_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_real' } },
    };
    const { rawBody, signature } = signEvent(event, env.STRIPE_WEBHOOK_SECRET);

    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: rawBody,
        headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('NEW');
  });

  it('rejects invalid signature with 400', async () => {
    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
        headers: { 'stripe-signature': 'fake' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
