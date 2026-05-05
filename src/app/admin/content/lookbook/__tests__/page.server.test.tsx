import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminLookbookPage from '../page';

describe('/admin/content/lookbook list page', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.lookbookImage.create({
      data: { src: 'https://example.com/a.jpg', alt: 'one', sortOrder: 0 },
    });
    await prisma.lookbookImage.create({
      data: { src: 'https://example.com/b.jpg', alt: 'two', sortOrder: 1 },
    });
  });

  it('renders grid with all images + New link', async () => {
    const el = await AdminLookbookPage();
    const html = renderToString(el);
    expect(html).toContain('https://example.com/a.jpg');
    expect(html).toContain('https://example.com/b.jpg');
    expect(html).toContain('/admin/content/lookbook/new');
  });
});
