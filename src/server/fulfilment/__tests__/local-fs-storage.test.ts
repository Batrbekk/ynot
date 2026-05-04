import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsStorage } from '../local-fs-storage';

describe('LocalFsStorage', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-labels-'));
  });

  it('writes and reads back PDF bytes', async () => {
    const storage = new LocalFsStorage(dir);
    const key = await storage.put('shipment-1', Buffer.from('PDF-1'));
    expect(existsSync(join(dir, key))).toBe(true);
    const read = await storage.get(key);
    expect(read.toString()).toBe('PDF-1');
  });

  it('uses .pdf extension', async () => {
    const storage = new LocalFsStorage(dir);
    const key = await storage.put('shipment-2', Buffer.from('x'));
    expect(key.endsWith('.pdf')).toBe(true);
  });

  it('overwrites on second put with same id', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('shipment-3', Buffer.from('v1'));
    await storage.put('shipment-3', Buffer.from('v2'));
    const key = await storage.put('shipment-3', Buffer.from('v3'));
    const read = await storage.get(key);
    expect(read.toString()).toBe('v3');
  });

  it('throws on get of missing key', async () => {
    const storage = new LocalFsStorage(dir);
    await expect(storage.get('nope.pdf')).rejects.toThrow();
  });

  it('delete removes the file and is idempotent on missing key', async () => {
    const storage = new LocalFsStorage(dir);
    const key = await storage.put('shipment-4', Buffer.from('bytes'));
    await storage.delete(key);
    expect(existsSync(join(dir, key))).toBe(false);
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });
});
