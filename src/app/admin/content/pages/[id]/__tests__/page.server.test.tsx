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

import AdminStaticPageDetailPage from '../page';

describe('/admin/content/pages/[id] markdown editor page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders editor with body markdown rendered in preview', async () => {
    const p = await prisma.staticPage.create({
      data: { slug: 'about', title: 'About us', bodyMarkdown: '# Hello world' },
    });
    const el = await AdminStaticPageDetailPage({ params: Promise.resolve({ id: p.id }) });
    const html = renderToString(el);
    expect(html).toContain('About us');
    expect(html).toContain('Hello world');
    // textarea + preview both rendered
    expect(html).toContain('markdown-textarea');
    expect(html).toContain('markdown-preview');
  });
});
