import { prisma } from '@/server/db/client';

type SluggedModel = 'product' | 'category' | 'staticpage';

export async function ensureUniqueSlug(
  model: SluggedModel,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  if (!baseSlug) throw new Error('baseSlug must be non-empty');
  let candidate = baseSlug;
  let suffix = 2;
  while (await collides(model, candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return candidate;
}

async function collides(model: SluggedModel, slug: string, excludeId?: string): Promise<boolean> {
  const where: { slug: string; id?: { not: string } } = { slug };
  if (excludeId) where.id = { not: excludeId };
  if (model === 'product') {
    return (await prisma.product.findFirst({ where })) !== null;
  }
  if (model === 'staticpage') {
    return (await prisma.staticPage.findFirst({ where })) !== null;
  }
  return (await prisma.category.findFirst({ where })) !== null;
}
