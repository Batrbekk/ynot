import { describe, expect, it } from "vitest";
import { OrderSchema } from "@/lib/schemas";
import { toOrder } from "../order";

const baseRow = {
  id: "internal-cuid",
  orderNumber: "YN-2026-0001",
  userId: "u1",
  status: "DELIVERED" as const,
  subtotalCents: 89500,
  shippingCents: 0,
  discountCents: 0,
  totalCents: 89500,
  currency: "GBP" as const,
  carrier: "ROYAL_MAIL" as const,
  trackingNumber: "RM12345678GB" as string | null,
  estimatedDeliveryDate: new Date("2026-04-01T00:00:00Z") as Date | null,
  shipFirstName: "Jane",
  shipLastName: "Doe",
  shipLine1: "42 King's Road",
  shipLine2: null as string | null,
  shipCity: "London",
  shipPostcode: "SW3 4ND",
  shipCountry: "GB",
  shipPhone: "+44 7700 900123",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  referrer: null,
  landingPath: null,
  promoCodeId: null as string | null,
  createdAt: new Date("2026-03-28T11:23:00Z"),
  updatedAt: new Date("2026-03-28T11:23:00Z"),
  items: [
    {
      id: "i1",
      orderId: "internal-cuid",
      productId: "p1",
      preorderBatchId: null,
      productSlug: "leather-jacket",
      productName: "Leather Jacket",
      productImage: "/p/a.jpg",
      colour: "Black",
      size: "M" as const,
      unitPriceCents: 89500,
      currency: "GBP" as const,
      quantity: 1,
      isPreorder: false,
      shipmentId: null as string | null,
    },
  ],
};

describe("toOrder", () => {
  it("uses orderNumber as the public id and parses through the Zod schema", () => {
    const r = toOrder(baseRow);
    expect(r.id).toBe("YN-2026-0001");
    expect(() => OrderSchema.parse(r)).not.toThrow();
  });

  it("lowercases status and hyphenates carrier", () => {
    const r = toOrder(baseRow);
    expect(r.status).toBe("delivered");
    expect(r.carrier).toBe("royal-mail");
  });

  it("renames money fields and snapshots line items", () => {
    const r = toOrder(baseRow);
    expect(r.subtotal).toBe(89500);
    expect(r.shipping).toBe(0);
    expect(r.total).toBe(89500);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      productId: "p1",
      slug: "leather-jacket",
      name: "Leather Jacket",
      image: "/p/a.jpg",
      colour: "Black",
      size: "M",
      unitPrice: 89500,
      quantity: 1,
      preOrder: false,
    });
  });

  it("constructs the nested shippingAddress from flat ship* columns", () => {
    const r = toOrder(baseRow);
    expect(r.shippingAddress).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      line1: "42 King's Road",
      line2: null,
      city: "London",
      postcode: "SW3 4ND",
      country: "GB",
      phone: "+44 7700 900123",
    });
  });

  it("formats createdAt as ISO string", () => {
    expect(toOrder(baseRow).createdAt).toBe("2026-03-28T11:23:00.000Z");
  });

  it("formats estimatedDeliveryDate as YYYY-MM-DD", () => {
    expect(toOrder(baseRow).estimatedDeliveryDate).toBe("2026-04-01");
  });

  it("returns empty string when estimatedDeliveryDate is null", () => {
    const r = toOrder({ ...baseRow, estimatedDeliveryDate: null });
    expect(r.estimatedDeliveryDate).toBe("");
  });

  it("converts DHL carrier to dhl", () => {
    expect(toOrder({ ...baseRow, carrier: "DHL" }).carrier).toBe("dhl");
  });
});
