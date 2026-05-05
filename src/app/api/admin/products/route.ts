import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductCreateSchema } from '@/lib/schemas/admin-product';
import { createProduct } from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin product creation. New products always start in DRAFT — promotion to
 * PUBLISHED is a separate transition through `/status` so the act of going
 * live is auditable on its own (see Phase 7a spec §9 catalog state-machine).
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
  const parsed = ProductCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const product = await createProduct({
    input: parsed.data,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product, { status: 201 });
}
