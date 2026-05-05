import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { createProduct } from '../product-service';

describe('createProduct', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a DRAFT product with auto-slug + writes audit row', async () => {
    const product = await createProduct({
      input: {
        name: 'Spring Coat',
        description: 'A trench.',
        priceCents: 45000,
        materials: 'wool',
        care: 'dry',
        sizing: 'true',
        preOrder: false,
      },
      actorId: 'u1',
    });
    expect(product.status).toBe('DRAFT');
    expect(product.slug).toBe('spring-coat');
    expect(product.publishedAt).toBeNull();

    const log = await prisma.auditLog.findFirst({
      where: { entityType: 'product', action: 'product.create' },
    });
    expect(log).not.toBeNull();
    expect((log!.after as { id: string }).id).toBe(product.id);
  });

  it('honours an explicit slug + suffixes on collision', async () => {
    await createProduct({
      input: {
        name: 'A',
        slug: 'spring-coat',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    const second = await createProduct({
      input: {
        name: 'B',
        slug: 'spring-coat',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    expect(second.slug).toBe('spring-coat-2');
  });
});
