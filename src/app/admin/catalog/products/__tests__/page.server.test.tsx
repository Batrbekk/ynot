import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminProductsPage from '../page';

describe('/admin/catalog/products list page', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.product.create({
      data: {
        name: 'Spring Coat',
        slug: 'spring-coat',
        description: 'd',
        priceCents: 45000,
        materials: '',
        care: '',
        sizing: '',
        status: 'PUBLISHED',
      },
    });
    await prisma.product.create({
      data: {
        name: 'Draft Boots',
        slug: 'draft-boots',
        description: 'd',
        priceCents: 9900,
        materials: '',
        care: '',
        sizing: '',
        status: 'DRAFT',
      },
    });
  });

  it('renders product rows + New product link', async () => {
    const el = await AdminProductsPage({ searchParams: Promise.resolve({}) });
    const html = renderToString(el);
    expect(html).toContain('Spring Coat');
    expect(html).toContain('Draft Boots');
    expect(html).toContain('/admin/catalog/products/new');
  });

  it('filters by status', async () => {
    const el = await AdminProductsPage({
      searchParams: Promise.resolve({ status: 'PUBLISHED' }),
    });
    const html = renderToString(el);
    expect(html).toContain('Spring Coat');
    expect(html).not.toContain('Draft Boots');
  });

  it('filters by search', async () => {
    const el = await AdminProductsPage({
      searchParams: Promise.resolve({ search: 'Draft' }),
    });
    const html = renderToString(el);
    expect(html).toContain('Draft Boots');
    expect(html).not.toContain('Spring Coat');
  });
});
