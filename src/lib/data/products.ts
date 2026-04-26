import { ProductSchema, type Product } from "../schemas";
import productsJson from "./_mock/products.json";

let cache: Product[] | null = null;

function load(): Product[] {
  if (cache) return cache;
  cache = productsJson.map((p) => ProductSchema.parse(p));
  return cache;
}

export async function getAllProducts(): Promise<Product[]> {
  return load();
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return load().find((p) => p.slug === slug) ?? null;
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<Product[]> {
  return load().filter((p) => p.categorySlugs.includes(categorySlug));
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  return load().slice(0, limit);
}

export async function getRecommendations(
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> {
  return load()
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, limit);
}
