import type { PrismaClient } from '@prisma/client';

export async function seedShipping(prisma: PrismaClient) {
  const uk = await prisma.shippingZone.upsert({
    where: { id: 'zone-uk' },
    create: { id: 'zone-uk', name: 'United Kingdom', countries: ['GB'], sortOrder: 0 },
    update: {},
  });
  const intl = await prisma.shippingZone.upsert({
    where: { id: 'zone-international' },
    create: { id: 'zone-international', name: 'International', countries: ['*'], sortOrder: 10 },
    update: {},
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'method-uk-rm-tracked48' },
    create: {
      id: 'method-uk-rm-tracked48', zoneId: uk.id,
      carrier: 'ROYAL_MAIL', name: 'Royal Mail Tracked 48',
      baseRateCents: 0, estimatedDaysMin: 2, estimatedDaysMax: 3, isActive: true, sortOrder: 0,
    },
    update: {},
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'method-intl-dhl-express' },
    create: {
      id: 'method-intl-dhl-express', zoneId: intl.id,
      carrier: 'DHL', name: 'DHL Express Worldwide (DDP)',
      baseRateCents: 2495, estimatedDaysMin: 3, estimatedDaysMax: 5, isActive: true, sortOrder: 0,
    },
    update: {},
  });
}
