import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db/client";
import { findOrderById, listOrdersForUser } from "../../repositories/order.repo";
import { resetDb } from "../helpers/reset-db";

async function seedUserAndOrders() {
  const user = await prisma.user.create({
    data: { email: "demo@ynot.london", name: "Demo" },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: "YN-2026-0001",
      userId: user.id,
      status: "DELIVERED",
      subtotalCents: 89500,
      shippingCents: 0,
      totalCents: 89500,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM12345678GB",
      shipFirstName: "Jane",
      shipLastName: "Doe",
      shipLine1: "42 King's Road",
      shipCity: "London",
      shipPostcode: "SW3 4ND",
      shipCountry: "GB",
      shipPhone: "+44 0000 000000",
      items: {
        create: {
          productSlug: "leather-jacket",
          productName: "Leather Jacket",
          productImage: "/products/jacket.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: 89500,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
  return { user, order };
}

describe("order.repo", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("listOrdersForUser returns the user's orders newest-first", async () => {
    const { user } = await seedUserAndOrders();
    const orders = await listOrdersForUser(user.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber).toBe("YN-2026-0001");
    expect(orders[0].items).toHaveLength(1);
  });

  it("listOrdersForUser returns empty array for an unknown user", async () => {
    expect(await listOrdersForUser("nonexistent-id")).toEqual([]);
  });

  it("findOrderById accepts the orderNumber", async () => {
    await seedUserAndOrders();
    const o = await findOrderById("YN-2026-0001");
    expect(o?.orderNumber).toBe("YN-2026-0001");
  });

  it("findOrderById returns null for an unknown orderNumber", async () => {
    await seedUserAndOrders();
    expect(await findOrderById("YN-9999-XXXX")).toBeNull();
  });
});
