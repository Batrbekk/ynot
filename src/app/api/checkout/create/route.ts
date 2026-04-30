import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/cart/resolve';
import { createOrderAndPaymentIntent } from '@/server/checkout/service';
import { CreateOrderRequest } from '@/lib/schemas/checkout';
import { getSessionUser } from '@/server/auth/session';
import { ATTRIBUTION_COOKIE_NAME, parseAttributionCookie } from '@/server/attribution/cookie';
import { StockConflictError } from '@/server/cart/service';
import { EmailTakenByFullAccountError } from '@/server/repositories/user.repo';

export const runtime = 'nodejs';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = CreateOrderRequest.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const cart = await resolveCart();
  const user = await getSessionUser();
  const cookieJar = await cookies();
  const attribution = parseAttributionCookie(cookieJar.get(ATTRIBUTION_COOKIE_NAME)?.value);

  try {
    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: user ? { id: user.id } : null,
      address: parsed.address,
      methodId: parsed.methodId,
      attribution,
    });

    // Set the ghost-order viewing cookie (24h TTL) so guest can view /success.
    cookieJar.set(ORDER_TOKEN_COOKIE, result.orderToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return NextResponse.json({
      orderId: result.orderId,
      clientSecret: result.clientSecret,
    });
  } catch (e) {
    if (e instanceof StockConflictError) {
      return NextResponse.json({ error: 'STOCK_CONFLICT' }, { status: 409 });
    }
    if (e instanceof EmailTakenByFullAccountError) {
      return NextResponse.json(
        { error: 'EMAIL_TAKEN', message: 'This email has a YNOT account — sign in to place your order.' },
        { status: 409 },
      );
    }
    if (e instanceof Error && /promo/i.test(e.message)) {
      return NextResponse.json({ error: 'PROMO_INVALID', message: e.message }, { status: 409 });
    }
    throw e;
  }
}
