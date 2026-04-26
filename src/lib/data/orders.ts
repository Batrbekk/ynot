import { OrderSchema, type Order } from "../schemas";
import ordersJson from "./_mock/orders.json";

let cache: Order[] | null = null;

function load(): Order[] {
  if (cache) return cache;
  cache = ordersJson.map((o) => OrderSchema.parse(o));
  return cache;
}

export async function getOrdersForCurrentUser(): Promise<Order[]> {
  return load();
}

export async function getOrderById(id: string): Promise<Order | null> {
  return load().find((o) => o.id === id) ?? null;
}
