import { vi } from 'vitest';

export function mockStripeSdk(opts: {
  intentId?: string;
  clientSecret?: string;
} = {}) {
  const defaultIntentId = opts.intentId ?? 'pi_test_' + Math.random().toString(36).slice(2, 8);
  const defaultClientSecret = opts.clientSecret ?? `${defaultIntentId}_secret_test`;
  let callCount = 0;
  const create = vi.fn(async () => {
    callCount++;
    // If caller pre-specified ids (or first call with no override), use the stable ones.
    // Subsequent calls in the same test get unique ids to avoid PK conflicts.
    if (callCount === 1 || opts.intentId) {
      return {
        id: defaultIntentId, client_secret: defaultClientSecret, amount: 0, currency: 'gbp',
        status: 'requires_payment_method', metadata: {},
      };
    }
    const callId = 'pi_test_' + Math.random().toString(36).slice(2, 12);
    const callSecret = `${callId}_secret_test`;
    return {
      id: callId, client_secret: callSecret, amount: 0, currency: 'gbp',
      status: 'requires_payment_method', metadata: {},
    };
  });
  vi.doMock('@/server/checkout/stripe', () => ({
    stripe: { paymentIntents: { create, retrieve: vi.fn() } },
  }));
  return { intentId: defaultIntentId, clientSecret: defaultClientSecret, create };
}
