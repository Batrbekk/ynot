import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsStorage } from '../local-fs-storage';

describe('LocalFsStorage', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-media-'));
  });

  it('writes file + .meta sidecar with content type', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('products/abc/img.jpg', Buffer.from('JPGBYTES'), 'image/jpeg');
    expect(existsSync(join(dir, 'products/abc/img.jpg'))).toBe(true);
    expect(existsSync(join(dir, 'products/abc/img.jpg.meta'))).toBe(true);
    expect(readFileSync(join(dir, 'products/abc/img.jpg.meta'), 'utf-8').trim()).toBe('image/jpeg');
  });

  it('reads back the same buffer + content type', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('lookbook/x.png', Buffer.from('PNG'), 'image/png');
    const r = await storage.get('lookbook/x.png');
    expect(r.buffer.toString()).toBe('PNG');
    expect(r.contentType).toBe('image/png');
  });

  it('throws on get of missing key', async () => {
    const storage = new LocalFsStorage(dir);
    await expect(storage.get('nope.jpg')).rejects.toThrow();
  });

  it('exists() returns true after put, false otherwise', async () => {
    const storage = new LocalFsStorage(dir);
    expect(await storage.exists('a.jpg')).toBe(false);
    await storage.put('a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(await storage.exists('a.jpg')).toBe(true);
  });

  it('delete removes file + .meta sidecar', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('a.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.delete('a.jpg');
    expect(await storage.exists('a.jpg')).toBe(false);
    expect(existsSync(join(dir, 'a.jpg.meta'))).toBe(false);
  });

  it('rejects keys containing ".."', async () => {
    const storage = new LocalFsStorage(dir);
    await expect(
      storage.put('../escape.jpg', Buffer.from('x'), 'image/jpeg'),
    ).rejects.toThrow(/invalid key/i);
    await expect(storage.get('../escape.jpg')).rejects.toThrow(/invalid key/i);
  });

  it('creates nested directories as needed', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('a/b/c/d.jpg', Buffer.from('x'), 'image/jpeg');
    expect(existsSync(join(dir, 'a/b/c/d.jpg'))).toBe(true);
  });
});
