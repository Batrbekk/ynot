import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetMediaStorageForTests } from '@/server/media/factory';

vi.mock('@/server/auth/nextauth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';

describe('POST /api/admin/media/upload', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-admin-upload-'));
    process.env.MEDIA_STORAGE = 'local';
    process.env.MEDIA_STORAGE_PATH = dir;
    _resetMediaStorageForTests();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  function makeForm(file: File): FormData {
    const fd = new FormData();
    fd.append('files', file);
    return fd;
  }

  it('rejects when not OWNER', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('uploads JPEG and returns key + url', async () => {
    const file = new File([Buffer.from('JPG')], 'photo.jpg', { type: 'image/jpeg' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploaded).toHaveLength(1);
    expect(data.uploaded[0].key).toMatch(/^products\/abc\/[A-Za-z0-9_-]{12}\.jpg$/);
    expect(data.uploaded[0].url).toContain('/api/media/products/abc/');
  });

  it('rejects PDF MIME', async () => {
    const file = new File([Buffer.from('PDF')], 'a.pdf', { type: 'application/pdf' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploaded).toHaveLength(0);
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0].reason).toMatch(/mime|type/i);
  });

  it('rejects oversize >5MB', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0].reason).toMatch(/size|5mb/i);
  });
});
