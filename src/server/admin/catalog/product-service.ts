import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import { ensureUniqueSlug } from './slug-service';
import { slugify } from '@/lib/slug';
import { assertProductTransition } from './product-status';
import type { ProductStatus } from '@prisma/client';
import type {
  ProductCreateInput,
  ProductUpdateInput,
} from '@/lib/schemas/admin-product';

export interface CreateProductOptions {
  input: ProductCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createProduct(opts: CreateProductOptions) {
  const { input, actorId, ip, ua } = opts;
  const baseSlug = input.slug ?? slugify(input.name);
  const slug = await ensureUniqueSlug('product', baseSlug);

  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: 'pending',
      action: 'product.create',
      ip,
      ua,
    },
    async () => {
      const product = await prisma.product.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          priceCents: input.priceCents,
          materials: input.materials ?? '',
          care: input.care ?? '',
          sizing: input.sizing ?? '',
          weightGrams: input.weightGrams,
          hsCode: input.hsCode,
          countryOfOriginCode: input.countryOfOriginCode,
          preOrder: input.preOrder,
          status: 'DRAFT',
        },
      });
      return product;
    },
  );
}

export interface UpdateProductOptions {
  id: string;
  input: ProductUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateProduct(opts: UpdateProductOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  // If slug explicitly given and changed, validate uniqueness; otherwise leave as-is.
  let slug = before.slug;
  if (input.slug && input.slug !== before.slug) {
    slug = await ensureUniqueSlug('product', input.slug, id);
  }

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action: 'product.update', before, ip, ua },
    async () =>
      prisma.product.update({
        where: { id },
        data: {
          name: input.name,
          slug,
          description: input.description,
          priceCents: input.priceCents,
          materials: input.materials,
          care: input.care,
          sizing: input.sizing,
          weightGrams: input.weightGrams,
          hsCode: input.hsCode,
          countryOfOriginCode: input.countryOfOriginCode,
          preOrder: input.preOrder,
        },
      }),
  );
}

export interface ChangeProductStatusOptions {
  id: string;
  to: ProductStatus;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function changeProductStatus(opts: ChangeProductStatusOptions) {
  const { id, to, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  assertProductTransition(before.status, to);

  const action =
    to === 'PUBLISHED'
      ? 'product.publish'
      : to === 'ARCHIVED'
        ? 'product.archive'
        : 'product.unpublish';

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action, before, ip, ua },
    async () =>
      prisma.product.update({
        where: { id },
        data: {
          status: to,
          publishedAt:
            to === 'PUBLISHED' && before.publishedAt === null
              ? new Date()
              : before.publishedAt,
        },
      }),
  );
}
