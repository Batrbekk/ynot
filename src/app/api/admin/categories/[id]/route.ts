import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { CategoryUpdateSchema } from '@/lib/schemas/admin-category';
import {
  updateCategory,
  archiveCategory,
} from '@/server/admin/catalog/category-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH` updates editable fields. When `parentId` changes the service
 * re-checks the tree for cycles; cycle errors surface as 422 so the client
 * can show a "would create a cycle" warning rather than a generic 500.
 *
 * `DELETE` is a soft archive (sets `deletedAt = now()`) — categories are
 * referenced by historical `ProductCategory` rows so we keep them around.
 */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = CategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await updateCategory({
      id,
      input: parsed.data,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(category);
  } catch (e) {
    const msg = (e as Error).message;
    if (/cycle/i.test(msg)) {
      return Response.json({ error: msg }, { status: 422 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const { id } = await ctx.params;
  const category = await archiveCategory({
    id,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(category);
}
