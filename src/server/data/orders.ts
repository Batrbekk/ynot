import type { Order } from "@/lib/schemas";
import {
  findOrderById,
  listOrdersForUser,
} from "@/server/repositories/order.repo";
import { getSessionUser } from "@/server/auth/session";
import { toOrder } from "./adapters/order";

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listOrdersForUser(user.id);
  return rows.map(toOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await findOrderById(id);
  return row ? toOrder(row) : null;
}
