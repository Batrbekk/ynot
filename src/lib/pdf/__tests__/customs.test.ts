import { describe, expect, it } from 'vitest';
import { buildCustomsDeclaration, type CustomsInput } from '../customs';

const input: CustomsInput = {
  returnNumber: 'RT-2026-00007',
  orderNumber: 'YN-2026-00042',
  fromAddress: {
    name: 'Anna Schmidt',
    line1: 'Friedrichstrasse 12',
    city: 'Berlin',
    postcode: '10117',
    country: 'DE',
  },
  toAddress: {
    line1: '13 Elvaston Place',
    city: 'London',
    postcode: 'SW7 5QG',
    country: 'GB',
  },
  items: [
    {
      name: 'Silk Scarf — Emerald',
      quantity: 1,
      valueCents: 24000,
      hsCode: '6214.10',
      countryOfOrigin: 'GB',
      weightGrams: 80,
    },
    {
      name: 'Wool Coat',
      quantity: 1,
      valueCents: 89500,
      hsCode: '6202.11',
      countryOfOrigin: 'IT',
      weightGrams: 1800,
    },
  ],
};

describe('buildCustomsDeclaration', () => {
  it('returns a Buffer beginning with the PDF magic bytes "%PDF-"', async () => {
    const out = await buildCustomsDeclaration(input);
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.length).toBeGreaterThan(100);
    expect(out.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders without throwing for items with null hsCode and countryOfOrigin', async () => {
    const out = await buildCustomsDeclaration({
      ...input,
      items: [
        {
          name: 'Mystery item',
          quantity: 2,
          valueCents: 1000,
          hsCode: null,
          countryOfOrigin: null,
          weightGrams: 200,
        },
      ],
    });
    expect(out.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders without throwing on an empty items list', async () => {
    const out = await buildCustomsDeclaration({ ...input, items: [] });
    expect(out.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
