import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { getShippingProvider } from '../zones';

describe('getShippingProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedBothZones() {
    const uk = await prisma.shippingZone.create({ data: { name: 'UK', countries: ['GB'] } });
    const intl = await prisma.shippingZone.create({ data: { name: 'International', countries: ['*'] } });
    await prisma.shippingMethod.create({
      data: { zoneId: uk.id, carrier: 'ROYAL_MAIL', name: 'RM48', baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3 },
    });
    await prisma.shippingMethod.create({
      data: { zoneId: intl.id, carrier: 'DHL', name: 'DHL DDP', baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5 },
    });
  }

  it('returns only UK provider for GB destination', async () => {
    await seedBothZones();
    const p = getShippingProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'GB' }, items: [], subtotalCents: 10000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0].carrier).toBe('ROYAL_MAIL');
  });

  it('returns only international provider for non-GB destination', async () => {
    await seedBothZones();
    const p = getShippingProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'FR' }, items: [], subtotalCents: 10000,
    });
    expect(quotes).toHaveLength(1);
    expect(quotes[0].carrier).toBe('DHL');
  });
});
