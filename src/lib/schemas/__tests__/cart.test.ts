import { describe, it, expect } from "vitest";
import { CartItemSchema, CartSchema, type Cart } from "../cart";

describe("CartItemSchema", () => {
  it("accepts a valid cart item", () => {
    expect(() =>
      CartItemSchema.parse({
        productId: "prod_001",
        slug: "belted-suede-field-jacket",
        name: "Belted Suede Field Jacket",
        image: "/images/products/belted/1.webp",
        colour: "Chocolate Brown",
        size: "M",
        unitPrice: 89500,
        quantity: 1,
        preOrder: false,
      }),
    ).not.toThrow();
  });

  it("rejects quantity 0", () => {
    expect(() =>
      CartItemSchema.parse({
        productId: "p",
        slug: "p",
        name: "n",
        image: "/i",
        colour: "c",
        size: "M",
        unitPrice: 1,
        quantity: 0,
        preOrder: false,
      }),
    ).toThrow();
  });
});

describe("CartSchema", () => {
  it("accepts an empty cart", () => {
    const cart: Cart = { items: [], promoCode: null, currency: "GBP" };
    expect(() => CartSchema.parse(cart)).not.toThrow();
  });
});
