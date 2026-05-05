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

import AdminHeroDetailPage from '../page';

describe('/admin/content/hero/[id] detail page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders edit form with current values', async () => {
    const h = await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://example.com/a.jpg',
        eyebrow: 'Spring',
        ctaLabel: 'Shop',
        ctaHref: '/shop',
        isActive: true,
      },
    });
    const el = await AdminHeroDetailPage({ params: Promise.resolve({ id: h.id }) });
    const html = renderToString(el);
    expect(html).toContain('Spring');
    expect(html).toContain('Active');
  });
});
