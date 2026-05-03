import { describe, expect, it } from 'vitest';
import type { Env } from '@/server/env';
import { buildDeps } from '../deps';
import { DhlExpressProvider } from '@/server/shipping/dhl-express';
import { RoyalMailClickDropProvider } from '@/server/shipping/royal-mail-click-drop';
import { DhlTrackingProvider } from '@/server/tracking/dhl';
import { RoyalMailTrackingProvider } from '@/server/tracking/royal-mail';

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DATABASE_URL: 'postgresql://x',
    REDIS_URL: 'redis://x',
    NODE_ENV: 'test',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'x'.repeat(32),
    STRIPE_SECRET_KEY: 'sk_test_x',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    ORDER_TOKEN_SECRET: 'x'.repeat(32),
    SHIPPING_PROVIDER: 'mock',
    LABEL_STORAGE: 'local',
    LABEL_STORAGE_PATH: '/tmp/ynot-labels-test',
    WORKER_ENABLED: true,
    ...overrides,
  } as Env;
}

describe('buildDeps', () => {
  it('produces all carrier and tracking providers', () => {
    const deps = buildDeps(fakeEnv());
    expect(deps.dhl).toBeInstanceOf(DhlExpressProvider);
    expect(deps.rm).toBeInstanceOf(RoyalMailClickDropProvider);
    expect(deps.providers.dhl).toBeInstanceOf(DhlTrackingProvider);
    expect(deps.providers.royalMail).toBeInstanceOf(RoyalMailTrackingProvider);
    expect(deps.storage).toBeDefined();
    expect(typeof deps.sendLabelFailureAlert).toBe('function');
    expect(typeof deps.sendTrackingStaleAlert).toBe('function');
    expect(typeof deps.tryCreateShipment).toBe('function');
  });

  it('does not throw when carrier env vars are absent', () => {
    expect(() =>
      buildDeps(
        fakeEnv({
          DHL_API_KEY: undefined,
          DHL_API_SECRET: undefined,
          DHL_ACCOUNT_NUMBER: undefined,
          ROYAL_MAIL_API_KEY: undefined,
        }),
      ),
    ).not.toThrow();
  });
});
