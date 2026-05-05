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

import AdminLookbookDetailPage from '../page';

describe('/admin/content/lookbook/[id] detail page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders edit form with current image', async () => {
    const img = await prisma.lookbookImage.create({
      data: { src: 'https://example.com/a.jpg', alt: 'hello', sortOrder: 0 },
    });
    const el = await AdminLookbookDetailPage({
      params: Promise.resolve({ id: img.id }),
    });
    const html = renderToString(el);
    expect(html).toContain('https://example.com/a.jpg');
    expect(html).toContain('hello');
  });
});
