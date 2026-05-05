import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductUpdateSchema } from '@/lib/schemas/admin-product';
import { updateProduct, changeProductStatus } from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH` updates editable fields (name, description, price, materials, etc.)
 * AND optionally re-links categories when `categoryIds` is provided. The
 * categoryIds extension is delegated to the service layer via the same
 * audit-wrapped write so the before/after JSON snapshot captures both.
 *
 * `DELETE` is a soft archive — products are never hard-deleted because
 * historical Order references depend on them (see Phase 7a spec §9).
 */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await updateProduct({
    id,
    input: parsed.data,
    actorId: session.user!.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product);
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const product = await changeProductStatus({
    id,
    to: 'ARCHIVED',
    actorId: session.user!.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product);
}
