import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { CategoryCreateSchema } from '@/lib/schemas/admin-category';
import { createCategory } from '@/server/admin/catalog/category-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin category creation. Slug auto-generates from name when not provided.
 * Cycle prevention only matters on subsequent moves — at create time the
 * caller picks `parentId` once and we trust the chain has no cycles yet.
 */
export async function POST(req: Request): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = CategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const category = await createCategory({
    input: parsed.data,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(category, { status: 201 });
}
