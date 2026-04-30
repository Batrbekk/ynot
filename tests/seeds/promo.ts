import type { PrismaClient } from '@prisma/client';

export async function seedPromos(prisma: PrismaClient) {
  await prisma.promoCode.upsert({
    where: { code: 'WELCOME10' },
    create: {
      code: 'WELCOME10',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderCents: 0,
      usageLimit: 100,
      isActive: true,
    },
    update: {},
  });
}
