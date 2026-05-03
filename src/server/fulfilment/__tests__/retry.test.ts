import { describe, expect, it } from 'vitest';
import { nextRetryDelayMs, shouldGiveUp } from '../retry';

describe('nextRetryDelayMs', () => {
  it('returns the canonical schedule for attempts 1..5', () => {
    expect(nextRetryDelayMs(1)).toBe(60_000); // 1m
    expect(nextRetryDelayMs(2)).toBe(300_000); // 5m
    expect(nextRetryDelayMs(3)).toBe(900_000); // 15m
    expect(nextRetryDelayMs(4)).toBe(3_600_000); // 1h
    expect(nextRetryDelayMs(5)).toBe(21_600_000); // 6h
  });

  it('returns null for attempt >= 6 (give up)', () => {
    expect(nextRetryDelayMs(6)).toBeNull();
    expect(nextRetryDelayMs(99)).toBeNull();
  });

  it('returns null for attempt < 1 (defensive)', () => {
    expect(nextRetryDelayMs(0)).toBeNull();
    expect(nextRetryDelayMs(-1)).toBeNull();
  });
});

describe('shouldGiveUp', () => {
  it('is false when attemptCount is below the schedule length', () => {
    expect(shouldGiveUp(0)).toBe(false);
    expect(shouldGiveUp(1)).toBe(false);
    expect(shouldGiveUp(4)).toBe(false);
  });

  it('is true once attemptCount reaches the schedule length (5)', () => {
    expect(shouldGiveUp(5)).toBe(true);
    expect(shouldGiveUp(6)).toBe(true);
  });
});
