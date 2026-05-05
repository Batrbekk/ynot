/**
 * Phase 7a end-to-end coverage (plan tasks 61-63).
 *
 * Walks one product from DRAFT → image upload → stock + colours → PUBLISH →
 * storefront read → ARCHIVE → storefront hidden, exercising every admin
 * route that ships in Phase 7a alongside the storefront repository. Then
 * exercises the Hero only-one-active invariant under sequential activate
 * and the Category cycle-prevention guard.
 *
 * The DB is real Postgres (server vitest project, single fork, sequential).
 * Auth is the only thing mocked — every route, service, audit write, and
 * filesystem media call runs for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { _resetMediaStorageForTests } from '@/server/media/factory';
import { findProductBySlug } from '@/server/repositories/product.repo';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

// Imports must run after the vi.mock above.
import { auth } from '@/server/auth/nextauth';
import { POST as createProductRoute } from '@/app/api/admin/products/route';
import { POST as uploadMediaRoute } from '@/app/api/admin/media/upload/route';
import { POST as addImagesRoute } from '@/app/api/admin/products/[id]/images/route';
import { PATCH as patchSizesRoute } from '@/app/api/admin/products/[id]/sizes/route';
import { PATCH as patchColoursRoute } from '@/app/api/admin/products/[id]/colours/route';
import { POST as changeStatusRoute } from '@/app/api/admin/products/[id]/status/route';
import {
  createHero,
  activateHero,
} from '@/server/admin/cms/hero-service';
import {
  createCategory,
  moveCategory,
} from '@/server/admin/catalog/category-service';
import { listCategories } from '@/server/repositories/category.repo';

function asMockedAuth() {
  return auth as unknown as { mockResolvedValue: (v: unknown) => void };
}

async function seedOwner(): Promise<string> {
  await prisma.user.create({
    data: { id: 'u-owner-7a', email: 'owner@ynot.test', role: 'OWNER' },
  });
  asMockedAuth().mockResolvedValue({
    user: { id: 'u-owner-7a', role: 'OWNER' },
  });
  return 'u-owner-7a';
}

// ---- Task 61: full product lifecycle (DRAFT → PUBLISHED → ARCHIVED) ----

describe('E2E — product lifecycle (Phase 7a)', () => {
  let mediaDir: string;

  beforeEach(async () => {
    await resetDb();
    mediaDir = mkdtempSync(join(tmpdir(), 'ynot-7a-e2e-'));
    process.env.MEDIA_STORAGE = 'local';
    process.env.MEDIA_STORAGE_PATH = mediaDir;
    _resetMediaStorageForTests();
  });

  afterEach(() => {
    _resetMediaStorageForTests();
  });

  it('creates DRAFT → uploads image → attaches → sets stock + colours → publishes → storefront sees it → archives → storefront hides it', async () => {
    const actorId = await seedOwner();

    // 1. Create the product (DRAFT).
    const createReq = new Request('http://x/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Lifecycle Coat',
        description: 'A coat for the lifecycle test.',
        priceCents: 32000,
        materials: 'Wool',
        care: 'Dry clean',
        sizing: 'Standard',
        weightGrams: 1500,
        hsCode: '620293',
        countryOfOriginCode: 'GB',
        preOrder: false,
      }),
    });
    const createRes = await createProductRoute(createReq);
    expect(createRes.status).toBe(201);
    const product = (await createRes.json()) as { id: string; slug: string; status: string };
    expect(product.status).toBe('DRAFT');
    expect(product.slug).toBe('lifecycle-coat');

    // Storefront should NOT see DRAFT.
    expect(await findProductBySlug(product.slug)).toBeNull();

    // 2. Upload an image via the real multipart route.
    const file = new File([Buffer.from('JPGBYTES')], 'photo.jpg', {
      type: 'image/jpeg',
    });
    const fd = new FormData();
    fd.append('files', file);
    const uploadReq = new Request(
      `http://x/api/admin/media/upload?prefix=products/${product.id}`,
      { method: 'POST', body: fd },
    );
    const uploadRes = await uploadMediaRoute(uploadReq);
    expect(uploadRes.status).toBe(200);
    const uploaded = (await uploadRes.json()) as {
      uploaded: Array<{ key: string; url: string }>;
      rejected: unknown[];
    };
    expect(uploaded.uploaded).toHaveLength(1);
    expect(uploaded.rejected).toEqual([]);
    const imageUrl = uploaded.uploaded[0].url;

    // 3. Attach the uploaded image to the product.
    const attachReq = new Request(
      `http://x/api/admin/products/${product.id}/images`,
      {
        method: 'POST',
        body: JSON.stringify({ items: [{ url: imageUrl, alt: 'cover' }] }),
      },
    );
    const attachRes = await addImagesRoute(attachReq, {
      params: Promise.resolve({ id: product.id }),
    });
    expect(attachRes.status).toBe(201);
    const attached = (await attachRes.json()) as Array<{ id: string }>;
    expect(attached).toHaveLength(1);

    // 4. Set sizes (stock).
    const sizesReq = new Request(
      `http://x/api/admin/products/${product.id}/sizes`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          sizes: [
            { size: 'M', stock: 5 },
            { size: 'L', stock: 3 },
          ],
        }),
      },
    );
    const sizesRes = await patchSizesRoute(sizesReq, {
      params: Promise.resolve({ id: product.id }),
    });
    expect(sizesRes.status).toBe(200);
    const sizes = (await sizesRes.json()) as Array<{ size: string; stock: number }>;
    expect(sizes).toHaveLength(2);
    const sizeMap = new Map(sizes.map((s) => [s.size, s.stock]));
    expect(sizeMap.get('M')).toBe(5);
    expect(sizeMap.get('L')).toBe(3);

    // 5. Set colours.
    const coloursReq = new Request(
      `http://x/api/admin/products/${product.id}/colours`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          colours: [
            { name: 'Black', hex: '#000000' },
            { name: 'Camel', hex: '#c19a6b' },
          ],
        }),
      },
    );
    const coloursRes = await patchColoursRoute(coloursReq, {
      params: Promise.resolve({ id: product.id }),
    });
    expect(coloursRes.status).toBe(200);
    const colours = (await coloursRes.json()) as Array<{ name: string }>;
    expect(colours.map((c) => c.name)).toEqual(['Black', 'Camel']);

    // 6. Publish.
    const publishReq = new Request(
      `http://x/api/admin/products/${product.id}/status`,
      { method: 'POST', body: JSON.stringify({ to: 'PUBLISHED' }) },
    );
    const publishRes = await changeStatusRoute(publishReq, {
      params: Promise.resolve({ id: product.id }),
    });
    expect(publishRes.status).toBe(200);
    const published = (await publishRes.json()) as {
      status: string;
      publishedAt: string | null;
    };
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();

    // 7. Storefront query now returns the product (with images, sizes, colours).
    const storefront = await findProductBySlug(product.slug);
    expect(storefront).not.toBeNull();
    expect(storefront!.id).toBe(product.id);
    expect(storefront!.images).toHaveLength(1);
    expect(storefront!.sizes).toHaveLength(2);
    expect(storefront!.colours).toHaveLength(2);

    // 8. Archive.
    const archiveReq = new Request(
      `http://x/api/admin/products/${product.id}/status`,
      { method: 'POST', body: JSON.stringify({ to: 'ARCHIVED' }) },
    );
    const archiveRes = await changeStatusRoute(archiveReq, {
      params: Promise.resolve({ id: product.id }),
    });
    expect(archiveRes.status).toBe(200);
    const archived = (await archiveRes.json()) as { status: string };
    expect(archived.status).toBe('ARCHIVED');

    // Storefront query no longer returns it.
    expect(await findProductBySlug(product.slug)).toBeNull();

    // 9. Verify AuditLog rows. We assert on action + actor; entityId can be
    // 'pending' for create actions (Group H Task 19) so we don't pin it.
    const auditRows = await prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'asc' },
      select: { action: true, entityType: true },
    });
    const actions = auditRows.map((r) => r.action);
    expect(actions).toContain('product.create');
    expect(actions).toContain('product.images.add');
    expect(actions).toContain('product.stock.update');
    expect(actions).toContain('product.colours.update');
    expect(actions).toContain('product.publish');
    expect(actions).toContain('product.archive');
    // All catalog audit rows belong to the product entity type.
    expect(auditRows.every((r) => r.entityType === 'product')).toBe(true);
  }, 30_000);
});

// ---- Task 62: Hero only-one-active invariant ----

describe('E2E — Hero only-one-active invariant under sequential activate', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('activating heroes 1 → 2 → 3 keeps exactly one active and writes one audit row per activation', async () => {
    const actorId = await seedOwner();

    const heroInput = (label: string) => ({
      kind: 'IMAGE' as const,
      imageUrl: `https://cdn.test/hero-${label}.jpg`,
      eyebrow: `Hero ${label}`,
      ctaLabel: 'Shop',
      ctaHref: '/shop',
    });

    const h1 = await createHero({ input: heroInput('1'), actorId });
    const h2 = await createHero({ input: heroInput('2'), actorId });
    const h3 = await createHero({ input: heroInput('3'), actorId });

    // After creation, none should be active.
    let activeCount = await prisma.heroBlock.count({ where: { isActive: true } });
    expect(activeCount).toBe(0);

    // Activate #1 → exactly one active.
    await activateHero({ id: h1.id, actorId });
    let rows = await prisma.heroBlock.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.find((r) => r.id === h1.id)!.isActive).toBe(true);
    expect(rows.find((r) => r.id === h2.id)!.isActive).toBe(false);
    expect(rows.find((r) => r.id === h3.id)!.isActive).toBe(false);
    activeCount = rows.filter((r) => r.isActive).length;
    expect(activeCount).toBe(1);

    // Activate #2 → #1 deactivates, #2 active.
    await activateHero({ id: h2.id, actorId });
    rows = await prisma.heroBlock.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.find((r) => r.id === h1.id)!.isActive).toBe(false);
    expect(rows.find((r) => r.id === h2.id)!.isActive).toBe(true);
    expect(rows.find((r) => r.id === h3.id)!.isActive).toBe(false);
    expect(rows.filter((r) => r.isActive)).toHaveLength(1);

    // Activate #3 → only #3 active.
    await activateHero({ id: h3.id, actorId });
    rows = await prisma.heroBlock.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.find((r) => r.id === h1.id)!.isActive).toBe(false);
    expect(rows.find((r) => r.id === h2.id)!.isActive).toBe(false);
    expect(rows.find((r) => r.id === h3.id)!.isActive).toBe(true);
    expect(rows.filter((r) => r.isActive)).toHaveLength(1);

    // Three hero.activate audit rows so far.
    let activateAudits = await prisma.auditLog.findMany({
      where: { actorId, action: 'hero.activate' },
    });
    expect(activateAudits).toHaveLength(3);

    // Idempotency: activating #3 again is a no-op (returns row, no audit).
    await activateHero({ id: h3.id, actorId });
    rows = await prisma.heroBlock.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.find((r) => r.id === h3.id)!.isActive).toBe(true);
    expect(rows.filter((r) => r.isActive)).toHaveLength(1);

    activateAudits = await prisma.auditLog.findMany({
      where: { actorId, action: 'hero.activate' },
    });
    expect(activateAudits).toHaveLength(3); // unchanged
  }, 30_000);
});

// ---- Task 63: Category cycle prevention ----

describe('E2E — Category cycle prevention', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects setting an ancestor as a descendant of its own subtree, leaving tree intact', async () => {
    const actorId = await seedOwner();

    const a = await createCategory({
      input: { name: 'Outerwear', description: '' },
      actorId,
    });
    const b = await createCategory({
      input: { name: 'Coats', description: '', parentId: a.id },
      actorId,
    });
    const c = await createCategory({
      input: { name: 'Trench Coats', description: '', parentId: b.id },
      actorId,
    });

    // Sanity: tree is A → B → C (each parent of next).
    expect(b.parentId).toBe(a.id);
    expect(c.parentId).toBe(b.id);

    // Attempting to make A a child of C would create a cycle. The service
    // throws a plain Error with a "cycle" message.
    await expect(
      moveCategory({ id: a.id, parentId: c.id, actorId }),
    ).rejects.toThrow(/cycle/i);

    // Tree is still intact: storefront-visible categories (deletedAt=null)
    // unchanged. Only A is a root.
    const all = await listCategories();
    const map = new Map(all.map((row) => [row.id, row]));
    expect(map.get(a.id)!.parentId).toBeNull();
    expect(map.get(b.id)!.parentId).toBe(a.id);
    expect(map.get(c.id)!.parentId).toBe(b.id);

    // No `category.move` audit row should have been written.
    const moveAudits = await prisma.auditLog.findMany({
      where: { actorId, action: 'category.move' },
    });
    expect(moveAudits).toHaveLength(0);
  }, 30_000);
});
