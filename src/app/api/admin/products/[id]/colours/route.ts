import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductColoursUpdateSchema } from '@/lib/schemas/admin-product';
import { setProductColours } from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

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
  const parsed = ProductColoursUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const colours = await setProductColours({
    productId: id,
    colours: parsed.data.colours,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(colours);
}
