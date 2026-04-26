import { describe, it, expect } from "vitest";
import { applyCatalogQuery } from "../filter";
import type { Product } from "@/lib/schemas";

const products: Product[] = [
  {
    id: "a",
    slug: "a",
    name: "Alpha",
    price: 50000,
    currency: "GBP",
    description: "",
    images: [],
    sizes: ["S", "M"],
    categorySlugs: ["jackets", "leather"],
    stock: { S: 1, M: 0 },
    preOrder: false,
    details: { materials: "", care: "", sizing: "" },
  },
  {
    id: "b",
    slug: "b",
    name: "Beta",
    price: 80000,
    currency: "GBP",
    description: "",
    images: [],
    sizes: ["M", "L"],
    categorySlugs: ["jackets", "wool"],
    stock: { M: 2, L: 1 },
    preOrder: false,
    details: { materials: "", care: "", sizing: "" },
  },
  {
    id: "c",
    slug: "c",
    name: "Gamma",
    price: 120000,
    currency: "GBP",
    description: "",
    images: [],
    sizes: ["S"],
    categorySlugs: ["coats", "wool"],
    stock: { S: 0 },
    preOrder: true,
    details: { materials: "", care: "", sizing: "" },
  },
];

describe("applyCatalogQuery", () => {
  it("returns all when no filters", () => {
    expect(applyCatalogQuery(products, {}).length).toBe(3);
  });
  it("filters by material via crossCategorySlug", () => {
    const r = applyCatalogQuery(products, { crossCategorySlug: "wool" });
    expect(r.map((p) => p.id)).toEqual(["b", "c"]);
  });
  it("filters by size", () => {
    const r = applyCatalogQuery(products, { size: "L" });
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });
  it("filters by max price (in pence)", () => {
    const r = applyCatalogQuery(products, { maxPrice: 80000 });
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("sorts by price asc", () => {
    const r = applyCatalogQuery(products, { sort: "price-asc" });
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by price desc", () => {
    const r = applyCatalogQuery(products, { sort: "price-desc" });
    expect(r.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
});
