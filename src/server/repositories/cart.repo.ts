import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

export type CartClient = Prisma.TransactionClient | typeof prisma;

const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function findCartByUserId(userId: string, client: CartClient = prisma) {
  return client.cart.findFirst({
    where: { userId },
    include: { items: true },
  });
}

export async function findCartBySessionToken(sessionToken: string, client: CartClient = prisma) {
  return client.cart.findUnique({
    where: { sessionToken },
    include: { items: true },
  });
}

export async function createGuestCart(sessionToken: string, client: CartClient = prisma) {
  return client.cart.create({
    data: {
      sessionToken,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function createUserCart(userId: string, client: CartClient = prisma) {
  return client.cart.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function adoptGuestCart(
  cartId: string,
  userId: string,
  client: CartClient = prisma,
) {
  return client.cart.update({
    where: { id: cartId },
    data: {
      userId,
      sessionToken: null,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
    include: { items: true },
  });
}

export async function deleteCart(cartId: string, client: CartClient = prisma) {
  await client.cart.delete({ where: { id: cartId } });
}
