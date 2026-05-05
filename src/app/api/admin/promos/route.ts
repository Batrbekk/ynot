import { Prisma } from '@prisma/client';
import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { PromoCreateSchema } from '@/lib/schemas/admin-promo';
import { createPromo } from '@/server/admin/promo/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = PromoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });

  try {
    const promo = await createPromo({
      input: parsed.data,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(promo, { status: 201 });
  } catch (e) {
    // P2002 = unique constraint violation on PromoCode.code.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return Response.json({ error: 'CONFLICT', message: 'code already exists' }, { status: 409 });
    }
    throw e;
  }
}
