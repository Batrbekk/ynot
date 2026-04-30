'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazy-loaded Stripe.js singleton. The publishable key is exposed via
 * NEXT_PUBLIC_* — safe to ship to the browser.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
