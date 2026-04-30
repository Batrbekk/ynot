// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

const FIXTURE_SNAPSHOT = {
  id: 'cart-1',
  items: [],
  subtotalCents: 0,
  discountCents: 0,
  promo: null,
  itemCount: 0,
  expiresAt: new Date().toISOString(),
};

describe('useCartStore', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => FIXTURE_SNAPSHOT,
    }) as unknown as Response) as any;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('hydrate fetches from /api/cart', async () => {
    const { useCartStore } = await import('../cart-store');
    await useCartStore.getState().hydrate();
    expect(global.fetch).toHaveBeenCalledWith('/api/cart', expect.objectContaining({ credentials: 'include' }));
    expect(useCartStore.getState().snapshot).toEqual(FIXTURE_SNAPSHOT);
  });

  it('addItem POSTs to /api/cart/items', async () => {
    const { useCartStore } = await import('../cart-store');
    await useCartStore.getState().addItem({
      productId: 'p1', size: 'S', colour: 'Black', quantity: 1, isPreorder: false,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cart/items',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles 409 STOCK_CONFLICT by setting error', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 409,
      json: async () => ({ error: 'STOCK_CONFLICT', stockAvailable: 2 }),
    }) as unknown as Response) as any;
    const { useCartStore } = await import('../cart-store');
    const result = await useCartStore.getState().addItem({
      productId: 'p1', size: 'S', colour: 'Black', quantity: 99, isPreorder: false,
    });
    expect(result).toMatchObject({ ok: false, error: 'STOCK_CONFLICT', stockAvailable: 2 });
  });
});
