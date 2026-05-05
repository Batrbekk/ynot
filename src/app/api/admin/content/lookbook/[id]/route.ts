import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { LookbookUpdateSchema } from '@/lib/schemas/admin-lookbook';
import { updateLookbook, deleteLookbook } from '@/server/admin/cms/lookbook-service';

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
  const parsed = LookbookUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const a = await updateLookbook({
      id,
      input: parsed.data,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(a);
  } catch (e) {
    if (/not found/i.test((e as Error).message)) return new Response('Not Found', { status: 404 });
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
  try {
    const a = await deleteLookbook({
      id,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(a);
  } catch (e) {
    if (/not found/i.test((e as Error).message)) return new Response('Not Found', { status: 404 });
    throw e;
  }
}
