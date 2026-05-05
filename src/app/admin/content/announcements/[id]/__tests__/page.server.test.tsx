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

import AdminAnnouncementDetailPage from '../page';

describe('/admin/content/announcements/[id] detail page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders edit form with current values', async () => {
    const a = await prisma.announcementMessage.create({
      data: { text: 'Free UK shipping', sortOrder: 2, isActive: true },
    });
    const el = await AdminAnnouncementDetailPage({
      params: Promise.resolve({ id: a.id }),
    });
    const html = renderToString(el);
    expect(html).toContain('Free UK shipping');
  });
});
