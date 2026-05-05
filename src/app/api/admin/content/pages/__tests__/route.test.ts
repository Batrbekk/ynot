import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';

describe('staticpage endpoints', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('POST 201 creates with auto-slug', async () => {
    const req = new Request('http://x/api/admin/content/pages', {
      method: 'POST',
      body: JSON.stringify({ title: 'About Us', bodyMarkdown: '# Hi' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.slug).toBe('about-us');
  });

  it('POST 400 invalid', async () => {
    const req = new Request('http://x/api/admin/content/pages', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('PATCH updates body markdown', async () => {
    const p = await prisma.staticPage.create({
      data: { slug: 'about', title: 'About', bodyMarkdown: '' },
    });
    const req = new Request(`http://x/api/admin/content/pages/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ bodyMarkdown: '# Hello' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).bodyMarkdown).toBe('# Hello');
  });

  it('DELETE removes page', async () => {
    const p = await prisma.staticPage.create({
      data: { slug: 'about', title: 'About', bodyMarkdown: '' },
    });
    const req = new Request(`http://x/api/admin/content/pages/${p.id}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    expect(await prisma.staticPage.findUnique({ where: { id: p.id } })).toBeNull();
  });
});
