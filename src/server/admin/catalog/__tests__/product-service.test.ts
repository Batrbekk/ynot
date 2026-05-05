import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { createProduct, updateProduct, changeProductStatus } from '../product-service';

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

describe('updateProduct', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates fields + writes audit row with before/after', async () => {
    const created = await createProduct({
      input: {
        name: 'Old',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    const updated = await updateProduct({
      id: created.id,
      input: { name: 'New', priceCents: 2 },
      actorId: 'u1',
    });
    expect(updated.name).toBe('New');
    expect(updated.priceCents).toBe(2);
    expect(updated.slug).toBe('old'); // slug not auto-changed when only name changes
    const log = await prisma.auditLog.findFirst({ where: { action: 'product.update' } });
    expect(log).not.toBeNull();
    expect((log!.before as { name: string }).name).toBe('Old');
    expect((log!.after as { name: string }).name).toBe('New');
  });
});

describe('changeProductStatus', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('DRAFT → PUBLISHED sets publishedAt', async () => {
    const p = await createProduct({
      input: {
        name: 'X',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    const before = Date.now();
    const published = await changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
    expect(published.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('PUBLISHED → DRAFT keeps publishedAt (history preserved)', async () => {
    const p = await createProduct({
      input: {
        name: 'X',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    await changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' });
    const drafted = await changeProductStatus({ id: p.id, to: 'DRAFT', actorId: 'u1' });
    expect(drafted.status).toBe('DRAFT');
    expect(drafted.publishedAt).not.toBeNull();
  });

  it('ARCHIVED → PUBLISHED throws (must go via DRAFT)', async () => {
    const p = await createProduct({
      input: {
        name: 'X',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
        preOrder: false,
      },
      actorId: 'u1',
    });
    await changeProductStatus({ id: p.id, to: 'ARCHIVED', actorId: 'u1' });
    await expect(
      changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' }),
    ).rejects.toThrow(/illegal/i);
  });
});
