import type { Order } from "@/lib/schemas";
import { prisma } from "@/server/db/client";
import {
  findOrderById,
  listOrdersForUser,
} from "@/server/repositories/order.repo";
import { toOrder } from "./adapters/order";

// PHASE 3: replace with await getSessionUser() once NextAuth is wired up.
const STUB_USER_EMAIL = "demo@ynot.london";

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const user = await prisma.user.findUnique({
    where: { email: STUB_USER_EMAIL },
  });
  if (!user) return [];
  const rows = await listOrdersForUser(user.id);
  return rows.map(toOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await findOrderById(id);
  return row ? toOrder(row) : null;
}
