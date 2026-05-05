import { describe, expect, it } from 'vitest';
import {
  ProductCreateSchema,
  ProductImagesReorderSchema,
  ProductSizesUpdateSchema,
  ProductColoursUpdateSchema,
  ProductStatusChangeSchema,
} from '../admin-product';

describe('ProductCreateSchema', () => {
  const valid = {
    name: 'Spring Coat',
    slug: 'spring-coat',
    description: 'A trench.',
    priceCents: 45000,
    materials: 'wool',
    care: 'dry clean',
    sizing: 'true to size',
    weightGrams: 1200,
    hsCode: '6201',
    countryOfOriginCode: 'GB',
    preOrder: false,
  };

  it('accepts a valid payload', () => {
    expect(ProductCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects negative priceCents', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, priceCents: -1 }).success).toBe(false);
  });
  it('rejects empty name', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });
  it('rejects 1-letter country code', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, countryOfOriginCode: 'G' }).success).toBe(
      false,
    );
  });
});

describe('ProductImagesReorderSchema', () => {
  it('accepts an array of cuid strings', () => {
    expect(ProductImagesReorderSchema.safeParse({ order: ['clxxx1', 'clxxx2'] }).success).toBe(
      true,
    );
  });
  it('rejects empty array', () => {
    expect(ProductImagesReorderSchema.safeParse({ order: [] }).success).toBe(false);
  });
});

describe('ProductSizesUpdateSchema', () => {
  it('accepts valid sizes payload', () => {
    expect(
      ProductSizesUpdateSchema.safeParse({
        sizes: [
          { size: 'M', stock: 5 },
          { size: 'L', stock: 0 },
        ],
      }).success,
    ).toBe(true);
  });
  it('rejects negative stock', () => {
    expect(
      ProductSizesUpdateSchema.safeParse({ sizes: [{ size: 'M', stock: -1 }] }).success,
    ).toBe(false);
  });
  it('rejects unknown size enum', () => {
    expect(
      ProductSizesUpdateSchema.safeParse({ sizes: [{ size: 'XXL', stock: 1 }] }).success,
    ).toBe(false);
  });
});

describe('ProductColoursUpdateSchema', () => {
  it('accepts valid colours', () => {
    expect(
      ProductColoursUpdateSchema.safeParse({ colours: [{ name: 'Bone', hex: '#EFEFE8' }] }).success,
    ).toBe(true);
  });
  it('rejects malformed hex', () => {
    expect(
      ProductColoursUpdateSchema.safeParse({ colours: [{ name: 'Bone', hex: 'EFEFE8' }] }).success,
    ).toBe(false);
  });
});

describe('ProductStatusChangeSchema', () => {
  it('accepts DRAFT/PUBLISHED/ARCHIVED', () => {
    for (const to of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      expect(ProductStatusChangeSchema.safeParse({ to }).success).toBe(true);
    }
  });
  it('rejects unknown status', () => {
    expect(ProductStatusChangeSchema.safeParse({ to: 'PAUSED' }).success).toBe(false);
  });
});
