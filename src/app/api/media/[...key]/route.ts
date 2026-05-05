import { getMediaStorage } from '@/server/media/factory';

/**
 * Public media stream — backs `${NEXT_PUBLIC_SITE_URL}/api/media/<key>` URLs
 * emitted by `publicUrlFor`. Long immutable cache because keys are content-
 * hashed via the upload route's nanoid.
 *
 * Reads the storage env from `process.env` at request time (not from the
 * cached `env` module) so that Vitest's per-test tmpdir swap + cache reset
 * pattern in `__tests__/route.test.ts` actually points at the new dir.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await ctx.params;
  const fullKey = key.join('/');
  if (fullKey.includes('..') || fullKey.startsWith('/')) {
    return new Response('Invalid key', { status: 400 });
  }
  const storage = getMediaStorage({
    MEDIA_STORAGE: process.env.MEDIA_STORAGE ?? 'local',
    MEDIA_STORAGE_PATH: process.env.MEDIA_STORAGE_PATH ?? '/var/lib/ynot/media',
  });
  if (!(await storage.exists(fullKey))) {
    return new Response('Not found', { status: 404 });
  }
  const { buffer, contentType } = await storage.get(fullKey);
  // BodyInit (DOM lib) doesn't accept Node's Buffer; slice to a plain
  // ArrayBuffer (matches the pattern in api/admin/shipments/.../label.pdf).
  const body = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
}
