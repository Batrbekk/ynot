import type Stripe from 'stripe';
import { stripe } from './stripe';
import { env } from '@/server/env';
import { prisma } from '@/server/db/client';
import { recordStripeEvent } from '@/server/repositories/stripe-event.repo';

export interface WebhookInput {
  rawBody: string;
  signature: string | null;
}

export interface WebhookResult {
  status: 200 | 400 | 500;
  body?: string;
}

export async function handleWebhook(input: WebhookInput): Promise<WebhookResult> {
  if (!input.signature) return { status: 400, body: 'missing signature' };
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(input.rawBody, input.signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return { status: 400, body: 'invalid signature' };
  }

  const { alreadyProcessed } = await recordStripeEvent(
    event.id,
    event.type,
    event as unknown as Record<string, unknown>,
  );
  if (alreadyProcessed) return { status: 200 };

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      // Unhandled events still get 200 so Stripe won't retry.
      break;
  }
  return { status: 200 };
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (order.status !== 'PENDING_PAYMENT') return; // replay or already handled

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'NEW',
        events: { create: { status: 'NEW', note: 'Payment received' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });

    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { usageCount: { increment: 1 } },
      });
      await tx.promoRedemption.create({
        data: {
          promoCodeId: order.promoCodeId,
          orderId: order.id,
          discountCents: order.discountCents,
        },
      });
    }

    // Mark guest user's email verified — receipt email implicitly confirms.
    if (order.userId) {
      await tx.user.update({
        where: { id: order.userId },
        data: { emailVerifiedAt: new Date() },
      });
    }
  });
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId }, include: { items: true },
    });
    if (order.status !== 'PENDING_PAYMENT') return;

    // Release stock.
    for (const item of order.items) {
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId!, size: item.size } },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_FAILED',
        events: { create: { status: 'PAYMENT_FAILED', note: pi.last_payment_error?.message ?? 'Payment failed' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  });
}
