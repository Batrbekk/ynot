import { describe, it, expect } from "vitest";
import { OrderSchema, OrderStatusSchema } from "../order";
import { AddressSchema } from "../address";

describe("AddressSchema", () => {
  it("accepts a UK address", () => {
    expect(() =>
      AddressSchema.parse({
        firstName: "Jane",
        lastName: "Doe",
        line1: "42 King's Road",
        line2: null,
        city: "London",
        postcode: "SW3 4ND",
        country: "GB",
        phone: "+44 7700 900123",
      }),
    ).not.toThrow();
  });
});

describe("OrderStatusSchema", () => {
  it("accepts known statuses", () => {
    for (const s of ["new", "processing", "shipped", "delivered", "returned"]) {
      expect(() => OrderStatusSchema.parse(s)).not.toThrow();
    }
  });
  it("rejects unknown status", () => {
    expect(() => OrderStatusSchema.parse("invented")).toThrow();
  });
});

describe("OrderSchema", () => {
  it("accepts a full order", () => {
    expect(() =>
      OrderSchema.parse({
        id: "YNT-20260414-0029",
        createdAt: "2026-04-14T10:00:00Z",
        status: "shipped",
        items: [
          {
            productId: "p",
            slug: "p",
            name: "n",
            image: "/i",
            colour: "c",
            size: "M",
            unitPrice: 100,
            quantity: 1,
            preOrder: false,
          },
        ],
        subtotal: 100,
        shipping: 0,
        total: 100,
        currency: "GBP",
        carrier: "royal-mail",
        trackingNumber: null,
        shippingAddress: {
          firstName: "Jane",
          lastName: "Doe",
          line1: "42 King's Road",
          line2: null,
          city: "London",
          postcode: "SW3 4ND",
          country: "GB",
          phone: "+44 7700 900123",
        },
        estimatedDeliveryDate: "2026-04-17",
      }),
    ).not.toThrow();
  });
});
