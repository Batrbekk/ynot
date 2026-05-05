import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminSettingsPage from '../page';

describe('/admin/content/settings page', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders defaults when the singleton row does not exist yet', async () => {
    const el = await AdminSettingsPage();
    const html = renderToString(el);
    expect(html).toContain('Site settings');
    expect(html).toContain('hello@ynot.london');
    expect(html).toContain('20000');
  });

  it('renders persisted values when the singleton exists', async () => {
    await prisma.sitePolicy.create({
      data: {
        id: 'singleton',
        defaultCurrency: 'GBP',
        defaultCarrier: 'DHL',
        freeShipThresholdCents: 30000,
        contactEmail: 'test@example.com',
        whatsappNumber: '+44 20 0000 0000',
      },
    });
    const el = await AdminSettingsPage();
    const html = renderToString(el);
    expect(html).toContain('test@example.com');
    expect(html).toContain('30000');
    expect(html).toContain('+44 20 0000 0000');
  });
});
