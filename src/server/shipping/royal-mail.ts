import { prisma } from '@/server/db/client';
import type { ShippingRateProvider, ShippingRateRequest, ShippingRateQuote } from './provider';

export class RoyalMailFreeProvider implements ShippingRateProvider {
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode !== 'GB') return [];
    const method = await prisma.shippingMethod.findFirst({
      where: { carrier: 'ROYAL_MAIL', isActive: true, zone: { countries: { has: 'GB' } } },
    });
    if (!method) return [];
    return [{
      methodId: method.id,
      name: method.name,
      carrier: 'ROYAL_MAIL',
      baseRateCents: 0,
      dutiesCents: 0,
      totalCents: 0,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
    }];
  }
}
