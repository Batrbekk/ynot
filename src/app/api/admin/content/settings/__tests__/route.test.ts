import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { PATCH } from '../route';

describe('PATCH /api/admin/content/settings', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('upserts singleton', async () => {
    const req = new Request('http://x/api/admin/content/settings', {
      method: 'PATCH',
      body: JSON.stringify({ contactEmail: 'hi@ynot.london' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('singleton');
    expect(data.contactEmail).toBe('hi@ynot.london');
  });

  it('403 non-owner', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/content/settings', {
      method: 'PATCH',
      body: JSON.stringify({ contactEmail: 'hi@x.com' }),
    });
    expect((await PATCH(req)).status).toBe(403);
  });

  it('400 on bad email', async () => {
    const req = new Request('http://x/api/admin/content/settings', {
      method: 'PATCH',
      body: JSON.stringify({ contactEmail: 'not-an-email' }),
    });
    expect((await PATCH(req)).status).toBe(400);
  });
});
