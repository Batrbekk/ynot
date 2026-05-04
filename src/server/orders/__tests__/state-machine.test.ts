import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  IllegalTransitionError,
  assertTransition,
} from '../state-machine';

describe('ALLOWED_TRANSITIONS', () => {
  it('covers every OrderStatus enum value', () => {
    const expected = [
      'PENDING_PAYMENT',
      'PAYMENT_FAILED',
      'NEW',
      'PROCESSING',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
      'PARTIALLY_DELIVERED',
      'DELIVERED',
      'RETURNED',
      'CANCELLED',
    ];
    for (const status of expected) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    expect(ALLOWED_TRANSITIONS.RETURNED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('assertTransition', () => {
  it('allows NEW → PROCESSING', () => {
    expect(() => assertTransition('NEW', 'PROCESSING')).not.toThrow();
  });

  it('allows PROCESSING → SHIPPED', () => {
    expect(() => assertTransition('PROCESSING', 'SHIPPED')).not.toThrow();
  });

  it('allows SHIPPED → DELIVERED', () => {
    expect(() => assertTransition('SHIPPED', 'DELIVERED')).not.toThrow();
  });

  it('allows DELIVERED → RETURNED', () => {
    expect(() => assertTransition('DELIVERED', 'RETURNED')).not.toThrow();
  });

  it('allows SHIPPED → RETURNED', () => {
    expect(() => assertTransition('SHIPPED', 'RETURNED')).not.toThrow();
  });

  it('allows NEW → CANCELLED', () => {
    expect(() => assertTransition('NEW', 'CANCELLED')).not.toThrow();
  });

  it('allows PENDING_PAYMENT → NEW', () => {
    expect(() => assertTransition('PENDING_PAYMENT', 'NEW')).not.toThrow();
  });

  it('allows same-state self transition', () => {
    expect(() => assertTransition('PROCESSING', 'PROCESSING')).not.toThrow();
  });

  it('throws IllegalTransitionError for DELIVERED → NEW', () => {
    expect(() => assertTransition('DELIVERED', 'NEW')).toThrow(IllegalTransitionError);
  });

  it('throws IllegalTransitionError for RETURNED → SHIPPED', () => {
    expect(() => assertTransition('RETURNED', 'SHIPPED')).toThrow(IllegalTransitionError);
  });

  it('throws IllegalTransitionError for CANCELLED → NEW', () => {
    expect(() => assertTransition('CANCELLED', 'NEW')).toThrow(IllegalTransitionError);
  });

  it('throws IllegalTransitionError for NEW → DELIVERED (skipping states)', () => {
    expect(() => assertTransition('NEW', 'DELIVERED')).toThrow(IllegalTransitionError);
  });

  it('error message includes from and to', () => {
    try {
      assertTransition('DELIVERED', 'NEW');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalTransitionError);
      expect((e as Error).message).toContain('DELIVERED');
      expect((e as Error).message).toContain('NEW');
    }
  });
});
