import { describe, expect, it, beforeEach } from 'vitest';
import { LocalFsStorage } from '../local-fs-storage';
import { createLabelStorage, getLabelStorage, __resetLabelStorageCache } from '../storage-factory';

describe('createLabelStorage', () => {
  it('returns LocalFsStorage when LABEL_STORAGE=local', () => {
    const storage = createLabelStorage({ LABEL_STORAGE: 'local', LABEL_STORAGE_PATH: '/tmp/x' });
    expect(storage).toBeInstanceOf(LocalFsStorage);
  });

  it('throws on s3 (not implemented)', () => {
    expect(() =>
      createLabelStorage({ LABEL_STORAGE: 's3', LABEL_STORAGE_PATH: '/tmp/x' }),
    ).toThrow(/not implemented/i);
  });

  it('throws on r2 (not implemented)', () => {
    expect(() =>
      createLabelStorage({ LABEL_STORAGE: 'r2', LABEL_STORAGE_PATH: '/tmp/x' }),
    ).toThrow(/not implemented/i);
  });

  it('throws on unknown backend', () => {
    expect(() =>
      createLabelStorage({ LABEL_STORAGE: 'azure', LABEL_STORAGE_PATH: '/tmp/x' }),
    ).toThrow(/not implemented/i);
  });
});

describe('getLabelStorage', () => {
  beforeEach(() => __resetLabelStorageCache());

  it('caches the singleton across calls', () => {
    const env = { LABEL_STORAGE: 'local', LABEL_STORAGE_PATH: '/tmp/x' };
    const a = getLabelStorage(env);
    const b = getLabelStorage(env);
    expect(a).toBe(b);
  });
});
