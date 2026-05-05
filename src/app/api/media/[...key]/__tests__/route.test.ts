import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsStorage } from '@/server/media/local-fs-storage';
import { _resetMediaStorageForTests } from '@/server/media/factory';
import { GET } from '../route';

describe('GET /api/media/[...key]', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-media-route-'));
    process.env.MEDIA_STORAGE = 'local';
    process.env.MEDIA_STORAGE_PATH = dir;
    _resetMediaStorageForTests();
  });

  it('streams file with correct content type + immutable cache header', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('products/abc/img.jpg', Buffer.from('JPG'), 'image/jpeg');
    _resetMediaStorageForTests();
    const req = new Request('http://localhost/api/media/products/abc/img.jpg');
    const res = await GET(req, {
      params: Promise.resolve({ key: ['products', 'abc', 'img.jpg'] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe('JPG');
  });

  it('404 when key missing', async () => {
    const req = new Request('http://localhost/api/media/nope.jpg');
    const res = await GET(req, { params: Promise.resolve({ key: ['nope.jpg'] }) });
    expect(res.status).toBe(404);
  });

  it('400 on traversal attempt (key contains "..")', async () => {
    const req = new Request('http://localhost/api/media/..%2Fescape.jpg');
    const res = await GET(req, {
      params: Promise.resolve({ key: ['..', 'escape.jpg'] }),
    });
    expect(res.status).toBe(400);
  });
});
