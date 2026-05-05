import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { ensureUniqueSlug } from '../slug-service';

describe('ensureUniqueSlug', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns the input slug when no collision', async () => {
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat');
  });

  it('appends -2 on first collision', async () => {
    await prisma.product.create({
      data: { slug: 'spring-coat', name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
    });
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat-2');
  });

  it('keeps incrementing past -2', async () => {
    for (const s of ['spring-coat', 'spring-coat-2', 'spring-coat-3']) {
      await prisma.product.create({
        data: { slug: s, name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
      });
    }
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat-4');
  });

  it('excludes a given id from collision check (for updates)', async () => {
    const p = await prisma.product.create({
      data: { slug: 'spring-coat', name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
    });
    const slug = await ensureUniqueSlug('product', 'spring-coat', p.id);
    expect(slug).toBe('spring-coat');
  });

  it('works for category model', async () => {
    await prisma.category.create({ data: { slug: 'outerwear', name: 'Outerwear' } });
    const slug = await ensureUniqueSlug('category', 'outerwear');
    expect(slug).toBe('outerwear-2');
  });

  it('works for staticpage model', async () => {
    await prisma.staticPage.create({
      data: { slug: 'about', title: 'About', bodyMarkdown: '' },
    });
    const slug = await ensureUniqueSlug('staticpage', 'about');
    expect(slug).toBe('about-2');
  });
});
