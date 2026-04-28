import type { Category } from "@/lib/schemas";
import {
  findCategoryBySlug,
  listCategories,
} from "@/server/repositories/category.repo";
import { toCategory } from "./adapters/category";

export async function getAllCategories(): Promise<Category[]> {
  const rows = await listCategories();
  return rows.map(toCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await findCategoryBySlug(slug);
  return row ? toCategory(row) : null;
}
