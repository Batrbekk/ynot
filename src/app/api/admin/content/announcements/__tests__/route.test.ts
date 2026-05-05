import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';

describe('announcement endpoints', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('POST 201 creates an announcement', async () => {
    const req = new Request('http://x/api/admin/content/announcements', {
      method: 'POST',
      body: JSON.stringify({ text: 'Free UK shipping' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.text).toBe('Free UK shipping');
  });

  it('POST 403 non-owner', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/content/announcements', {
      method: 'POST',
      body: JSON.stringify({ text: 'X' }),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it('PATCH updates + DELETE removes', async () => {
    const a = await prisma.announcementMessage.create({ data: { text: 'old' } });
    const reqU = new Request(`http://x/api/admin/content/announcements/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ text: 'new' }),
    });
    const resU = await PATCH(reqU, { params: Promise.resolve({ id: a.id }) });
    expect(resU.status).toBe(200);
    expect((await resU.json()).text).toBe('new');

    const reqD = new Request(`http://x/api/admin/content/announcements/${a.id}`, { method: 'DELETE' });
    const resD = await DELETE(reqD, { params: Promise.resolve({ id: a.id }) });
    expect(resD.status).toBe(200);
    expect(await prisma.announcementMessage.findUnique({ where: { id: a.id } })).toBeNull();
  });
});
