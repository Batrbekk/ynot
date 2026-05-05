import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminCategoriesPage from '../page';

describe('/admin/catalog/categories tree page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders empty state when no categories', async () => {
    const el = await AdminCategoriesPage();
    const html = renderToString(el);
    expect(html).toContain('No categories yet');
    expect(html).toContain('/admin/catalog/categories/new');
  });

  it('renders nested tree with parent + child indentation', async () => {
    const parent = await prisma.category.create({
      data: { slug: 'outer', name: 'Outerwear' },
    });
    await prisma.category.create({
      data: { slug: 'coats', name: 'Coats', parentId: parent.id },
    });
    const el = await AdminCategoriesPage();
    const html = renderToString(el);
    expect(html).toContain('Outerwear');
    expect(html).toContain('Coats');
    // Child marker shows hierarchy.
    expect(html).toContain('↳');
  });

  it('hides soft-deleted categories', async () => {
    await prisma.category.create({
      data: { slug: 'live', name: 'Live' },
    });
    await prisma.category.create({
      data: { slug: 'gone', name: 'Gone', deletedAt: new Date() },
    });
    const el = await AdminCategoriesPage();
    const html = renderToString(el);
    expect(html).toContain('Live');
    expect(html).not.toContain('>Gone<');
  });

  it('shows product counts', async () => {
    const cat = await prisma.category.create({
      data: { slug: 'c', name: 'Stuff' },
    });
    const product = await prisma.product.create({
      data: {
        slug: 'p',
        name: 'P',
        description: 'd',
        priceCents: 1,
        materials: '',
        care: '',
        sizing: '',
      },
    });
    await prisma.productCategory.create({
      data: { categoryId: cat.id, productId: product.id },
    });
    const el = await AdminCategoriesPage();
    const html = renderToString(el);
    expect(html).toMatch(/Stuff[\s\S]*1/);
  });
});
