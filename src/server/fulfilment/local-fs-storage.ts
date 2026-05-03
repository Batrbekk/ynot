import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LabelStorage } from './label-storage';

/**
 * Filesystem-backed {@link LabelStorage} for development and small deployments.
 *
 * All files live under a single root directory; keys are `${id}.pdf`.
 * The directory is created lazily on first write.
 */
export class LocalFsStorage implements LabelStorage {
  constructor(private readonly root: string) {}

  async put(id: string, content: Buffer): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const key = `${id}.pdf`;
    await writeFile(join(this.root, key), content);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    await unlink(join(this.root, key)).catch(() => {});
  }
}
