import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db/client";
import { getOrderById, getOrdersForCurrentUser } from "@/server/data/orders";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

const sessionMock = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getSessionUser: () => sessionMock(),
}));

async function seedUserAndOrder() {
  const user = await prisma.user.create({
    data: { email: "u@x.com", name: "Demo", emailVerifiedAt: new Date() },
  });
  await prisma.order.create({
    data: {
      orderNumber: "YN-2026-0001",
      userId: user.id,
      status: "DELIVERED",
      subtotalCents: 89500,
      shippingCents: 0,
      totalCents: 89500,
      carrier: "ROYAL_MAIL",
      trackingNumber: "RM12345678GB",
      estimatedDeliveryDate: new Date("2026-04-01T00:00:00Z"),
      shipFirstName: "Jane",
      shipLastName: "Doe",
      shipLine1: "42 King's Road",
      shipCity: "London",
      shipPostcode: "SW3 4ND",
      shipCountry: "GB",
      shipPhone: "+44 7700 900123",
      items: {
        create: {
          productSlug: "leather-jacket",
          productName: "Leather Jacket",
          productImage: "/p/a.jpg",
          colour: "Black",
          size: "M",
          unitPriceCents: 89500,
          quantity: 1,
          isPreorder: false,
        },
      },
    },
  });
  return user;
}

describe("server/data/orders", () => {
  beforeEach(async () => {
    await resetDb();
    sessionMock.mockReset();
  });

  it("getOrdersForCurrentUser returns the session user's orders", async () => {
    const user = await seedUserAndOrder();
    sessionMock.mockResolvedValue({
      id: user.id,
      email: user.email,
      name: user.name,
      role: "CUSTOMER",
      emailVerifiedAt: user.emailVerifiedAt,
    });
    const orders = await getOrdersForCurrentUser();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe("YN-2026-0001");
    expect(orders[0].status).toBe("delivered");
    expect(orders[0].carrier).toBe("royal-mail");
    expect(orders[0].shippingAddress.city).toBe("London");
  });

  it("getOrdersForCurrentUser returns empty array when no session", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await getOrdersForCurrentUser()).toEqual([]);
  });

  it("getOrderById accepts an orderNumber and returns the order regardless of session", async () => {
    await seedUserAndOrder();
    sessionMock.mockResolvedValue(null);
    const o = await getOrderById("YN-2026-0001");
    expect(o?.id).toBe("YN-2026-0001");
    expect(o?.estimatedDeliveryDate).toBe("2026-04-01");
  });

  it("getOrderById returns null when not found", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await getOrderById("YN-9999-XXXX")).toBeNull();
  });
});
