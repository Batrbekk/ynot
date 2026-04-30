import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('env.ts (Phase 4 additions)', () => {
  it('requires STRIPE_SECRET_KEY when validating', async () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      await expect(import('../env?phase4-missing-stripe')).rejects.toThrow(
        /STRIPE_SECRET_KEY/i,
      );
    } finally {
      if (original !== undefined) process.env.STRIPE_SECRET_KEY = original;
    }
  });

  it('requires ORDER_TOKEN_SECRET to be at least 32 chars', () => {
    // We construct the schema manually here to avoid module-cache issues.
    const schema = z.object({
      ORDER_TOKEN_SECRET: z.string().min(32),
    });
    expect(() => schema.parse({ ORDER_TOKEN_SECRET: 'short' })).toThrow();
    expect(schema.parse({ ORDER_TOKEN_SECRET: 'x'.repeat(32) }).ORDER_TOKEN_SECRET).toHaveLength(32);
  });

  it('defaults SHIPPING_PROVIDER to "mock"', async () => {
    process.env.SHIPPING_PROVIDER = '';
    const mod = await import('../env?phase4-default-shipping');
    expect(mod.env.SHIPPING_PROVIDER).toBe('mock');
  });
});
