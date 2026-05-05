import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { POST, PATCH as REORDER } from '../route';
import { PATCH, DELETE } from '../[id]/route';

describe('lookbook endpoints', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('POST 201 creates a lookbook image at end', async () => {
    const req = new Request('http://x/api/admin/content/lookbook', {
      method: 'POST',
      body: JSON.stringify({ src: 'https://x/a.jpg', alt: 'A' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alt).toBe('A');
    expect(data.sortOrder).toBe(0);
  });

  it('PATCH /lookbook reorders by id sequence', async () => {
    const a = await prisma.lookbookImage.create({ data: { src: 'https://x/a.jpg', sortOrder: 0 } });
    const b = await prisma.lookbookImage.create({ data: { src: 'https://x/b.jpg', sortOrder: 1 } });
    const req = new Request('http://x/api/admin/content/lookbook', {
      method: 'PATCH',
      body: JSON.stringify({ order: [b.id, a.id] }),
    });
    const res = await REORDER(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
  });

  it('PATCH /lookbook/[id] updates a single image; DELETE removes', async () => {
    const a = await prisma.lookbookImage.create({ data: { src: 'https://x/a.jpg' } });
    const reqU = new Request(`http://x/api/admin/content/lookbook/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ alt: 'A2' }),
    });
    const resU = await PATCH(reqU, { params: Promise.resolve({ id: a.id }) });
    expect(resU.status).toBe(200);
    expect((await resU.json()).alt).toBe('A2');

    const reqD = new Request(`http://x/api/admin/content/lookbook/${a.id}`, { method: 'DELETE' });
    const resD = await DELETE(reqD, { params: Promise.resolve({ id: a.id }) });
    expect(resD.status).toBe(200);
    expect(await prisma.lookbookImage.findUnique({ where: { id: a.id } })).toBeNull();
  });

  it('POST 403 non-owner', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/content/lookbook', {
      method: 'POST',
      body: JSON.stringify({ src: 'https://x/a.jpg' }),
    });
    expect((await POST(req)).status).toBe(403);
  });
});
