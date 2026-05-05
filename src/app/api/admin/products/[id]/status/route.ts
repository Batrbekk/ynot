import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductStatusChangeSchema } from '@/lib/schemas/admin-product';
import { changeProductStatus } from '@/server/admin/catalog/product-service';
import { IllegalProductTransitionError } from '@/server/admin/catalog/product-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Drives the DRAFT → PUBLISHED → ARCHIVED state-machine. Illegal transitions
 * (e.g. ARCHIVED → PUBLISHED) bubble up as `IllegalProductTransitionError`
 * which we map to 422 — the request was well-formed, the state just doesn't
 * permit the move.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const product = await changeProductStatus({
      id,
      to: parsed.data.to,
      actorId: session.user!.id,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(product);
  } catch (e) {
    if (e instanceof IllegalProductTransitionError) {
      return Response.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }
}
