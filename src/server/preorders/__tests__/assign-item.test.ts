import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { assignItemToBatch } from '../service';

async function seedProduct(slug: string) {
  return prisma.product.create({
    data: {
      slug, name: 'P', priceCents: 1000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      sizes: { create: [{ size: 'M', stock: 0 }] },
      images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
    },
  });
}

describe('assignItemToBatch', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns the earliest PENDING batch for the product', async () => {
    const product = await seedProduct('po-a');
    const later = await prisma.preorderBatch.create({
      data: {
        name: 'SS27',
        productId: product.id,
        status: 'PENDING',
        estimatedShipFrom: new Date('2027-03-01'),
        estimatedShipTo: new Date('2027-03-15'),
      },
    });
    const earlier = await prisma.preorderBatch.create({
      data: {
        name: 'SS26',
        productId: product.id,
        status: 'PENDING',
        estimatedShipFrom: new Date('2026-09-01'),
        estimatedShipTo: new Date('2026-09-15'),
      },
    });
    expect(await assignItemToBatch(product.id)).toBe(earlier.id);
    expect(await assignItemToBatch(product.id)).not.toBe(later.id);
  });

  it('considers IN_PRODUCTION batches alongside PENDING', async () => {
    const product = await seedProduct('po-b');
    const inProd = await prisma.preorderBatch.create({
      data: {
        name: 'AW26', productId: product.id,
        status: 'IN_PRODUCTION',
        estimatedShipFrom: new Date('2026-08-01'),
        estimatedShipTo: new Date('2026-08-15'),
      },
    });
    await prisma.preorderBatch.create({
      data: {
        name: 'AW27', productId: product.id, status: 'PENDING',
        estimatedShipFrom: new Date('2027-01-01'),
        estimatedShipTo: new Date('2027-01-15'),
      },
    });
    expect(await assignItemToBatch(product.id)).toBe(inProd.id);
  });

  it('skips SHIPPING + COMPLETED batches', async () => {
    const product = await seedProduct('po-c');
    await prisma.preorderBatch.create({
      data: {
        name: 'shipping', productId: product.id, status: 'SHIPPING',
        estimatedShipFrom: new Date('2025-01-01'),
        estimatedShipTo: new Date('2025-01-15'),
      },
    });
    await prisma.preorderBatch.create({
      data: {
        name: 'completed', productId: product.id, status: 'COMPLETED',
        estimatedShipFrom: new Date('2024-01-01'),
        estimatedShipTo: new Date('2024-01-15'),
      },
    });
    expect(await assignItemToBatch(product.id)).toBeNull();
  });

  it('returns null when no batches exist for the product', async () => {
    const product = await seedProduct('po-d');
    expect(await assignItemToBatch(product.id)).toBeNull();
  });

  it('does not match batches for a different product', async () => {
    const productA = await seedProduct('po-a-only');
    const productB = await seedProduct('po-b-only');
    await prisma.preorderBatch.create({
      data: {
        name: 'A-batch', productId: productA.id, status: 'PENDING',
        estimatedShipFrom: new Date('2026-01-01'),
        estimatedShipTo: new Date('2026-01-15'),
      },
    });
    expect(await assignItemToBatch(productB.id)).toBeNull();
  });
});
