import { describe, expect, it } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('lowercases and replaces whitespace', () => {
    expect(slugify('Spring Trench Coat')).toBe('spring-trench-coat');
  });
  it('strips non-alphanumeric except hyphens', () => {
    expect(slugify('Coat #5 — Black/Bone')).toBe('coat-5-black-bone');
  });
  it('collapses multiple hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });
  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
  it('preserves digits', () => {
    expect(slugify('Coat 2026')).toBe('coat-2026');
  });
});
