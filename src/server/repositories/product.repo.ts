import type { Product } from "@prisma/client";
import { prisma } from "../db/client";

export type ProductWithRelations = Product & {
  images: { url: string; alt: string; sortOrder: number }[];
  sizes: { size: string; stock: number }[];
  colours: { name: string; hex: string; sortOrder: number }[];
};

const include = {
  images: { orderBy: { sortOrder: "asc" } },
  sizes: true,
  colours: { orderBy: { sortOrder: "asc" } },
} as const;

export async function findProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
    include,
  });
  return product as ProductWithRelations | null;
}

export async function listProducts(): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}
