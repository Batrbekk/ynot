import { describe, expect, it } from 'vitest';
import type {
  LandedCostInput,
  LandedCostQuote,
  ShippingQuote,
  ShippingRateProvider,
} from '../provider';

describe('ShippingRateProvider — Phase 5 extensions', () => {
  it('LandedCostQuote shape includes dutyCents and taxCents', () => {
    const q: LandedCostQuote = { dutyCents: 1000, taxCents: 500, currency: 'GBP', breakdown: [] };
    expect(q.dutyCents + q.taxCents).toBe(1500);
  });

  it('LandedCostInput carries per-item HS / origin / weight metadata', () => {
    const input: LandedCostInput = {
      destinationCountry: 'DE',
      items: [
        {
          productSlug: 'silk-scarf-emerald',
          hsCode: '6214.10',
          weightGrams: 80,
          unitPriceCents: 24000,
          quantity: 2,
          countryOfOriginCode: 'GB',
        },
      ],
    };
    expect(input.items[0]?.quantity).toBe(2);
    expect(input.items[0]?.hsCode).toBe('6214.10');
  });

  it('ShippingQuote carries baseRateCents + transit window', () => {
    const q: ShippingQuote = {
      name: 'DHL Express Worldwide',
      baseRateCents: 4550,
      currency: 'GBP',
      estimatedDaysMin: 2,
      estimatedDaysMax: 2,
    };
    expect(q.baseRateCents).toBe(4550);
  });

  it('provider supports landedCost method', () => {
    const fake: ShippingRateProvider = {
      getRate: async () => ({
        baseRateCents: 0,
        currency: 'GBP',
        name: '',
        estimatedDaysMin: 0,
        estimatedDaysMax: 0,
      }),
      landedCost: async () => ({ dutyCents: 0, taxCents: 0, currency: 'GBP', breakdown: [] }),
    };
    expect(typeof fake.landedCost).toBe('function');
  });
});
