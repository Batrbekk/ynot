import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getSessionUser } from '@/server/auth/session';
import { verifyOrderToken } from '@/server/checkout/order-token';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, payment: true, user: true },
  });
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // 1) Authorised user owns it?
  const user = await getSessionUser();
  if (user && order.userId === user.id) {
    return NextResponse.json(serialise(order));
  }

  // 2) Anon with valid order token?
  const cookieJar = await cookies();
  const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value;
  const verified = verifyOrderToken(tokenValue ?? '');
  if (verified && verified.orderId === order.id &&
      verified.createdAt === order.createdAt.toISOString()) {
    return NextResponse.json(serialise(order));
  }

  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}

function serialise(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    currency: order.currency,
    carrier: order.carrier,
    items: order.items,
    isGuestOrder: order.user?.isGuest === true,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    shipping: {
      firstName: order.shipFirstName, lastName: order.shipLastName,
      line1: order.shipLine1, line2: order.shipLine2,
      city: order.shipCity, postcode: order.shipPostcode,
      country: order.shipCountry, phone: order.shipPhone,
    },
    createdAt: order.createdAt,
  };
}
