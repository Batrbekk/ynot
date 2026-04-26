import { CategorySchema, type Category } from "../schemas";
import categoriesJson from "./_mock/categories.json";

let cache: Category[] | null = null;

function load(): Category[] {
  if (cache) return cache;
  cache = categoriesJson
    .map((c) => CategorySchema.parse(c))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return cache;
}

export async function getAllCategories(): Promise<Category[]> {
  return load();
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return load().find((c) => c.slug === slug) ?? null;
}
