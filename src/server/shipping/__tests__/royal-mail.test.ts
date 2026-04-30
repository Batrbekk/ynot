import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { RoyalMailFreeProvider } from '../royal-mail';

describe('RoyalMailFreeProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedUkZone() {
    const zone = await prisma.shippingZone.create({ data: { name: 'UK', countries: ['GB'] } });
    return prisma.shippingMethod.create({
      data: {
        zoneId: zone.id, carrier: 'ROYAL_MAIL', name: 'Royal Mail Tracked 48',
        baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3,
      },
    });
  }

  it('returns single £0 quote for GB', async () => {
    await seedUkZone();
    const p = new RoyalMailFreeProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' },
      destination: { countryCode: 'GB' },
      items: [{ productId: 'x', quantity: 1, weightGrams: 1500, unitPriceCents: 20000 }],
      subtotalCents: 20000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      carrier: 'ROYAL_MAIL', baseRateCents: 0, dutiesCents: 0, totalCents: 0,
    });
  });

  it('returns no quotes for non-GB', async () => {
    await seedUkZone();
    const p = new RoyalMailFreeProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' },
      destination: { countryCode: 'FR' },
      items: [],
      subtotalCents: 0,
    });
    expect(quotes).toEqual([]);
  });
});
