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

import AdminProductDetailPage from '../page';

describe('/admin/catalog/products/[id] detail page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders product header (name + slug + status)', async () => {
    const p = await prisma.product.create({
      data: {
        name: 'Spring Coat',
        slug: 'spring-coat',
        description: 'A trench.',
        priceCents: 45000,
        materials: 'wool',
        care: '',
        sizing: '',
        status: 'DRAFT',
      },
    });
    const el = await AdminProductDetailPage({ params: Promise.resolve({ id: p.id }) });
    const html = renderToString(el);
    expect(html).toContain('Spring Coat');
    expect(html).toContain('spring-coat');
    expect(html).toContain('DRAFT');
    expect(html).toContain('A trench.');
    // Has the action buttons
    expect(html).toContain('Publish');
    expect(html).toContain('Archive');
  });
});
