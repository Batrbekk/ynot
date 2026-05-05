import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { PromoUpdateSchema } from '@/lib/schemas/admin-promo';
import { updatePromo } from '@/server/admin/promo/service';

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

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PromoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const promo = await updatePromo({
      id,
      input: parsed.data,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(promo);
  } catch (e) {
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) return new Response('Not Found', { status: 404 });
    if (/percent/i.test(msg)) {
      return Response.json({ error: 'VALIDATION', message: msg }, { status: 400 });
    }
    throw e;
  }
}
