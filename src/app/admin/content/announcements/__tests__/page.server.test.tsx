import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminAnnouncementsPage from '../page';

describe('/admin/content/announcements list page', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.announcementMessage.create({
      data: { text: 'Free UK shipping', sortOrder: 0, isActive: true },
    });
    await prisma.announcementMessage.create({
      data: { text: 'Hidden draft', sortOrder: 1, isActive: false },
    });
  });

  it('renders all announcements + New link', async () => {
    const el = await AdminAnnouncementsPage();
    const html = renderToString(el);
    expect(html).toContain('Free UK shipping');
    expect(html).toContain('Hidden draft');
    expect(html).toContain('/admin/content/announcements/new');
  });
});
