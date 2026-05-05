import { describe, expect, it } from 'vitest';
import { contentTypeForExt, extFromContentType } from '../content-type';

describe('contentTypeForExt', () => {
  it('maps .jpg to image/jpeg', () => {
    expect(contentTypeForExt('.jpg')).toBe('image/jpeg');
    expect(contentTypeForExt('.jpeg')).toBe('image/jpeg');
  });
  it('maps .png to image/png', () => {
    expect(contentTypeForExt('.png')).toBe('image/png');
  });
  it('maps .webp to image/webp', () => {
    expect(contentTypeForExt('.webp')).toBe('image/webp');
  });
  it('maps .mp4 to video/mp4', () => {
    expect(contentTypeForExt('.mp4')).toBe('video/mp4');
  });
  it('returns application/octet-stream for unknown', () => {
    expect(contentTypeForExt('.xyz')).toBe('application/octet-stream');
  });
});

describe('extFromContentType', () => {
  it('maps image/jpeg to .jpg', () => {
    expect(extFromContentType('image/jpeg')).toBe('.jpg');
  });
  it('maps image/webp to .webp', () => {
    expect(extFromContentType('image/webp')).toBe('.webp');
  });
});
