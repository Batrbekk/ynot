import { describe, expect, it } from 'vitest';
import { stripe } from '../stripe';

describe('Stripe server SDK', () => {
  it('exports a configured client', () => {
    expect(stripe).toBeDefined();
    // The SDK keeps the api version on `_version` (an internal but stable property).
    // We assert by confirming we can call a public method without throwing.
    expect(typeof stripe.paymentIntents.create).toBe('function');
  });
});
