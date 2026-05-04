import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { CreateReturnRequestSchema } from '@/lib/schemas/return';
import { prisma } from '@/server/db/client';
import { getSessionUser } from '@/server/auth/session';
import { verifyOrderToken } from '@/server/checkout/order-token';
import { createReturn } from '@/server/returns/service';
import { buildReturnsDeps } from '@/server/returns/deps';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

/**
 * Customer-initiated return creation.
 *
 * Auth: dual-mode — accepts either an authenticated session (where
 * `Order.userId === session.user.id`) **or** a valid signed
 * `__ynot_order_token` cookie scoped to the same order. Mirrors GET
 * /api/orders/[id] from Phase 4.
 *
 * On success returns `{ returnId, returnNumber }`. Validation failures →
 * `400`; ownership failures → `403`; missing order → `404`. Service errors
 * (window violation, qty conflict, etc.) → `409`.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = CreateReturnRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_BODY', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  if (!(await canAccessOrder(order.id, order.userId, order.createdAt))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const ret = await createReturn(input, buildReturnsDeps());
    return NextResponse.json(
      { returnId: ret.id, returnNumber: ret.returnNumber },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: 'CONFLICT', message }, { status: 409 });
  }
}

async function canAccessOrder(
  orderId: string,
  ownerId: string | null,
  createdAt: Date,
): Promise<boolean> {
  const user = await getSessionUser();
  if (user && ownerId && user.id === ownerId) return true;

  const cookieJar = await cookies();
  const token = cookieJar.get(ORDER_TOKEN_COOKIE)?.value ?? '';
  const verified = verifyOrderToken(token);
  if (!verified) return false;
  return verified.orderId === orderId &&
    verified.createdAt === createdAt.toISOString();
}
