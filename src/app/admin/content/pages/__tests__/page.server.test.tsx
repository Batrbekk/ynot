import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminStaticPagesPage from '../page';

describe('/admin/content/pages list page', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.staticPage.create({
      data: { slug: 'about', title: 'About', bodyMarkdown: '# Hi' },
    });
    await prisma.staticPage.create({
      data: { slug: 'faq', title: 'FAQ', bodyMarkdown: '# FAQ' },
    });
  });

  it('renders all pages + New link', async () => {
    const el = await AdminStaticPagesPage();
    const html = renderToString(el);
    expect(html).toContain('About');
    expect(html).toContain('FAQ');
    expect(html).toContain('/admin/content/pages/new');
  });
});
