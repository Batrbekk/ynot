import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import type { MediaStorage } from './storage';

/**
 * Filesystem-backed `MediaStorage`. Files live under `root` keyed by their
 * media key; a `.meta` sidecar holds the content type so reads don't have
 * to re-derive it from the extension.
 *
 * Keys are user-supplied — every public method runs `resolve()` first which
 * rejects path traversal (`..`, absolute paths) before touching disk.
 */
export class LocalFsStorage implements MediaStorage {
  constructor(private root: string) {}

  private resolve(key: string): string {
    if (key.includes('..')) throw new Error(`invalid key: ${key}`);
    const normalized = normalize(key);
    if (normalized.startsWith('/') || normalized.startsWith('..')) {
      throw new Error(`invalid key: ${key}`);
    }
    return join(this.root, normalized);
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    await writeFile(`${path}.meta`, contentType);
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const path = this.resolve(key);
    const [buffer, meta] = await Promise.all([
      readFile(path),
      readFile(`${path}.meta`, 'utf-8').catch(() => 'application/octet-stream'),
    ]);
    return { buffer, contentType: meta.trim() };
  }

  async delete(key: string): Promise<void> {
    const path = this.resolve(key);
    await Promise.all([
      unlink(path).catch(() => {}),
      unlink(`${path}.meta`).catch(() => {}),
    ]);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
