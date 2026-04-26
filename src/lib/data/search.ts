import type { Product } from "../schemas";
import { getAllProducts } from "./products";

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await getAllProducts();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.colour?.toLowerCase().includes(q) ||
      p.categorySlugs.some((c) => c.includes(q)) ||
      p.description.toLowerCase().includes(q),
  );
}
