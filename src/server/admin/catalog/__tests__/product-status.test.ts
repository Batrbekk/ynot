import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PRODUCT_TRANSITIONS,
  assertProductTransition,
  IllegalProductTransitionError,
} from '../product-status';

describe('ALLOWED_PRODUCT_TRANSITIONS', () => {
  it('DRAFT → PUBLISHED, ARCHIVED', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.DRAFT).toContain('PUBLISHED');
    expect(ALLOWED_PRODUCT_TRANSITIONS.DRAFT).toContain('ARCHIVED');
  });
  it('PUBLISHED → DRAFT, ARCHIVED', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.PUBLISHED).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('ARCHIVED → DRAFT only', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.ARCHIVED).toEqual(['DRAFT']);
  });
});

describe('assertProductTransition', () => {
  it('passes for legal pairs', () => {
    expect(() => assertProductTransition('DRAFT', 'PUBLISHED')).not.toThrow();
  });
  it('throws IllegalProductTransitionError on illegal', () => {
    expect(() => assertProductTransition('PUBLISHED', 'DRAFT')).not.toThrow(); // legal
    // ARCHIVED → PUBLISHED is illegal (must go via DRAFT)
    expect(() => assertProductTransition('ARCHIVED', 'PUBLISHED')).toThrow(
      IllegalProductTransitionError,
    );
  });
  it('passes for same-status (no-op)', () => {
    expect(() => assertProductTransition('DRAFT', 'DRAFT')).not.toThrow();
  });
});
