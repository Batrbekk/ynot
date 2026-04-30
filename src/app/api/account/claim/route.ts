import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { hashPassword } from '@/server/auth/password';
import { verifyOrderToken } from '@/server/checkout/order-token';
import { ClaimAccountRequest } from '@/lib/schemas/checkout';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = ClaimAccountRequest.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cookieJar = await cookies();
  const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value;
  const verified = verifyOrderToken(tokenValue ?? '');
  if (!verified || verified.orderId !== parsed.orderId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    include: { user: true },
  });
  if (!order || !order.user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (order.user.passwordHash !== null || !order.user.isGuest) {
    return NextResponse.json({ error: 'ALREADY_CLAIMED' }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.password);
  await prisma.user.update({
    where: { id: order.user.id },
    data: {
      passwordHash,
      isGuest: false,
      emailVerifiedAt: order.user.emailVerifiedAt ?? new Date(),
    },
  });

  cookieJar.delete(ORDER_TOKEN_COOKIE);
  return NextResponse.json({ ok: true });
}
