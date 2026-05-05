import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { AnnouncementCreateSchema } from '@/lib/schemas/admin-announcement';
import { createAnnouncement } from '@/server/admin/cms/announcement-service';

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
  const parsed = AnnouncementCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const a = await createAnnouncement({
    input: parsed.data,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(a, { status: 201 });
}
