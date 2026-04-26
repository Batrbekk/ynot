import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "../product-jsonld";
import type { Product } from "@/lib/schemas";

const product: Product = {
  id: "p1",
  slug: "leather-biker-jacket",
  name: "Leather Biker Jacket",
  price: 89500,
  currency: "GBP",
  description: "An asymmetric leather biker jacket.",
  images: ["/cms/products/03.jpg", "/cms/lookbook/01.jpg"],
  colour: "Black",
  sizes: ["S", "M", "L"],
  categorySlugs: ["jackets", "leather"],
  stock: { S: 0, M: 3, L: 1 },
  preOrder: false,
  details: { materials: "Leather", care: "", sizing: "" },
};

describe("buildProductJsonLd", () => {
  it("returns Product schema with required fields", () => {
    const json = buildProductJsonLd(product, "https://ynotlondon.com");
    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("Product");
    expect(json.name).toBe("Leather Biker Jacket");
    expect(json.image).toEqual([
      "https://ynotlondon.com/cms/products/03.jpg",
      "https://ynotlondon.com/cms/lookbook/01.jpg",
    ]);
    expect(json.brand?.name).toBe("YNOT London");
    expect(json.offers.priceCurrency).toBe("GBP");
    expect(json.offers.price).toBe("895.00");
    expect(json.offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock when no size has stock and not pre-order", () => {
    const out = { ...product, stock: { S: 0, M: 0, L: 0 }, preOrder: false };
    const json = buildProductJsonLd(out, "https://ynotlondon.com");
    expect(json.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("marks pre-order availability", () => {
    const pre = { ...product, stock: { S: 0, M: 0, L: 0 }, preOrder: true };
    const json = buildProductJsonLd(pre, "https://ynotlondon.com");
    expect(json.offers.availability).toBe("https://schema.org/PreOrder");
  });
});
