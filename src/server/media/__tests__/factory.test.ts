import { describe, expect, it } from 'vitest';
import { LocalFsStorage } from '../local-fs-storage';
import { createMediaStorage } from '../factory';

describe('createMediaStorage', () => {
  it('returns LocalFsStorage when MEDIA_STORAGE=local', () => {
    const storage = createMediaStorage({
      MEDIA_STORAGE: 'local',
      MEDIA_STORAGE_PATH: '/tmp/x',
    });
    expect(storage).toBeInstanceOf(LocalFsStorage);
  });

  it('throws on s3 (not yet implemented)', () => {
    expect(() =>
      createMediaStorage({ MEDIA_STORAGE: 's3', MEDIA_STORAGE_PATH: '/tmp/x' }),
    ).toThrow(/not yet implemented/i);
  });

  it('throws on r2 (not yet implemented)', () => {
    expect(() =>
      createMediaStorage({ MEDIA_STORAGE: 'r2', MEDIA_STORAGE_PATH: '/tmp/x' }),
    ).toThrow(/not yet implemented/i);
  });
});
