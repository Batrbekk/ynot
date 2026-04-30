import Stripe from 'stripe';
import { env } from '@/server/env';

/**
 * Server-side Stripe SDK singleton. API version pinned to match the version
 * Stripe CLI forwards (2025-02-24.acacia) — keeps webhook fixtures stable.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});
