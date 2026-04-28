import type { Product } from "@/lib/schemas";
import { searchProducts as searchProductsRepo } from "@/server/repositories/product.repo";
import { toProduct } from "./adapters/product";

export async function searchProducts(query: string): Promise<Product[]> {
  const rows = await searchProductsRepo(query);
  return rows.map(toProduct);
}
