import type { Order, OrderItem } from "@prisma/client";
import { prisma } from "../db/client";

export type OrderWithItems = Order & { items: OrderItem[] };

const include = { items: true } as const;

export async function listOrdersForUser(userId: string): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include,
  });
}

export async function findOrderById(orderNumber: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({
    where: { orderNumber },
    include,
  });
}
