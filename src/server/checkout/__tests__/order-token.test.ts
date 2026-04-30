import { describe, expect, it } from 'vitest';
import { signOrderToken, verifyOrderToken } from '../order-token';

describe('order-token', () => {
  it('round-trips a signed token', () => {
    const orderId = 'order-abc';
    const createdAt = new Date('2026-04-30T12:00:00Z');
    const token = signOrderToken(orderId, createdAt);
    const result = verifyOrderToken(token);
    expect(result).toEqual({ orderId, createdAt: createdAt.toISOString() });
  });

  it('rejects tampered token', () => {
    const token = signOrderToken('order-x', new Date());
    const bad = token.slice(0, -2) + 'XX';
    expect(verifyOrderToken(bad)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyOrderToken('')).toBeNull();
    expect(verifyOrderToken('garbage')).toBeNull();
  });
});
