import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import AdminCategoryEditPage from '../page';

describe('/admin/catalog/categories/[id] edit page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders edit form with initial values', async () => {
    const cat = await prisma.category.create({
      data: { slug: 'outer', name: 'Outerwear', description: 'warm.' },
    });
    const el = await AdminCategoryEditPage({ params: Promise.resolve({ id: cat.id }) });
    const html = renderToString(el);
    expect(html).toContain('Outerwear');
    expect(html).toContain('outer');
    expect(html).toContain('warm.');
  });

  it('marks self + descendants as disabled cycle options', async () => {
    const a = await prisma.category.create({ data: { slug: 'a', name: 'A' } });
    const b = await prisma.category.create({
      data: { slug: 'b', name: 'B', parentId: a.id },
    });
    await prisma.category.create({
      data: { slug: 'c', name: 'C', parentId: b.id },
    });
    // Editing A → A, B, and C must all be disabled.
    const el = await AdminCategoryEditPage({ params: Promise.resolve({ id: a.id }) });
    const html = renderToString(el);
    // Each illegal option carries the "(cycle)" marker.
    const cycleMarkerCount = (html.match(/\(cycle\)/g) ?? []).length;
    expect(cycleMarkerCount).toBeGreaterThanOrEqual(3);
  });

  it('returns notFound on archived/missing category', async () => {
    const cat = await prisma.category.create({
      data: { slug: 'gone', name: 'Gone', deletedAt: new Date() },
    });
    await expect(
      AdminCategoryEditPage({ params: Promise.resolve({ id: cat.id }) }),
    ).rejects.toThrow();
  });
});
