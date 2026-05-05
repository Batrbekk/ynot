import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminHeroPage from '../page';

describe('/admin/content/hero list page', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://example.com/a.jpg',
        eyebrow: 'Spring',
        ctaLabel: 'Shop now',
        ctaHref: '/shop',
        isActive: true,
      },
    });
    await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://example.com/b.jpg',
        eyebrow: 'Winter',
        ctaLabel: 'Browse',
        ctaHref: '/winter',
        isActive: false,
      },
    });
  });

  it('renders all heroes with active badge + New hero link', async () => {
    const el = await AdminHeroPage();
    const html = renderToString(el);
    expect(html).toContain('Spring');
    expect(html).toContain('Winter');
    expect(html).toContain('/admin/content/hero/new');
    expect(html).toContain('Active');
  });
});
