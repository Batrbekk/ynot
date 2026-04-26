import type { Product, Size } from "@/lib/schemas";

export type CatalogSort = "newest" | "price-asc" | "price-desc";

export interface CatalogQuery {
  /** A second category to intersect with (e.g. material slug while on /collection/jackets). */
  crossCategorySlug?: string;
  size?: Size;
  maxPrice?: number;
  sort?: CatalogSort;
}

export function applyCatalogQuery(
  products: Product[],
  query: CatalogQuery,
): Product[] {
  let result = products;

  if (query.crossCategorySlug) {
    const cross = query.crossCategorySlug;
    result = result.filter((p) => p.categorySlugs.includes(cross));
  }
  if (query.size) {
    const s = query.size;
    result = result.filter((p) => p.sizes.includes(s));
  }
  if (typeof query.maxPrice === "number") {
    const max = query.maxPrice;
    result = result.filter((p) => p.price <= max);
  }

  if (query.sort === "price-asc") {
    result = [...result].sort((a, b) => a.price - b.price);
  } else if (query.sort === "price-desc") {
    result = [...result].sort((a, b) => b.price - a.price);
  }
  // "newest" is implicit insertion order (mock has no createdAt yet)

  return result;
}
