import { describe, expect, it } from 'vitest';
import { LocalFsStorage } from '../local-fs-storage';
import { createMediaStorage, publicUrlFor } from '../factory';

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

describe('publicUrlFor', () => {
  it('joins NEXT_PUBLIC_SITE_URL + /api/media + key by default', () => {
    expect(
      publicUrlFor('products/abc/img.jpg', { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }),
    ).toBe('http://localhost:3000/api/media/products/abc/img.jpg');
  });
  it('uses MEDIA_PUBLIC_BASE_URL override', () => {
    expect(
      publicUrlFor('a/b.jpg', {
        NEXT_PUBLIC_SITE_URL: 'x',
        MEDIA_PUBLIC_BASE_URL: 'https://media.ynotlondon.com',
      }),
    ).toBe('https://media.ynotlondon.com/a/b.jpg');
  });
  it('strips trailing slash from base + leading slash from key', () => {
    expect(
      publicUrlFor('/a.jpg', {
        NEXT_PUBLIC_SITE_URL: 'http://x/',
        MEDIA_PUBLIC_BASE_URL: 'http://x/m/',
      }),
    ).toBe('http://x/m/a.jpg');
  });
});
