import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { MockDhlProvider } from '../mock-dhl';

describe('MockDhlProvider', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedIntlZone() {
    const zone = await prisma.shippingZone.create({ data: { name: 'International', countries: ['*'] } });
    await prisma.shippingMethod.create({
      data: {
        zoneId: zone.id, carrier: 'DHL', name: 'DHL Express Worldwide (DDP)',
        baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5,
      },
    });
  }

  it('returns no quotes for GB', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const quotes = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'GB' }, items: [], subtotalCents: 20000,
    });
    expect(quotes).toEqual([]);
  });

  it('EU destination: £24.95 shipping + 20% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'DE' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(2495);
    expect(q.dutiesCents).toBe(4000); // 20% of 20000
    expect(q.totalCents).toBe(6495);
  });

  it('US destination: £34.95 shipping + 0% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'US' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(3495);
    expect(q.dutiesCents).toBe(0);
    expect(q.totalCents).toBe(3495);
  });

  it('AU destination: £44.95 shipping + 10% GST', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'AU' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(4495);
    expect(q.dutiesCents).toBe(2000);
    expect(q.totalCents).toBe(6495);
  });

  it('ROW destination: £49.95 shipping + 0% duties', async () => {
    await seedIntlZone();
    const p = new MockDhlProvider();
    const [q] = await p.quote({
      origin: { country: 'GB' }, destination: { countryCode: 'KZ' }, items: [], subtotalCents: 20000,
    });
    expect(q.baseRateCents).toBe(4995);
    expect(q.dutiesCents).toBe(0);
  });
});
