import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetDb } from "@/server/__tests__/helpers/reset-db";
import { prisma } from "@/server/db/client";
import { signOrderToken } from "@/server/checkout/order-token";

vi.mock("@/server/auth/session", () => ({
  getSessionUser: vi.fn(async () => null),
}));

const _testCookies: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      _testCookies[name] ? { value: _testCookies[name] } : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers()),
}));

import { getCustomerOrderById } from "../customer-orders";
import { getSessionUser } from "@/server/auth/session";

const mockSession = vi.mocked(getSessionUser);

async function seedOrderWithShipmentAndEvents(opts: { ownerEmail?: string } = {}) {
  const user = await prisma.user.create({
    data: {
      email: opts.ownerEmail ?? `g-${Date.now()}@x.com`,
      passwordHash: null,
      isGuest: !opts.ownerEmail,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `YN-2026-T${Math.floor(Math.random() * 100000)}`,
      userId: user.id,
      status: "SHIPPED",
      subtotalCents: 20000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 20000,
      currency: "GBP",
      carrier: "ROYAL_MAIL",
      shipFirstName: "Ada",
      shipLastName: "Lovelace",
      shipLine1: "1 Mathematics Way",
      shipCity: "London",
      shipPostcode: "SW7 5QG",
      shipCountry: "GB",
      shipPhone: "+447000000000",
      items: {
        create: [
          {
            productSlug: "p1",
            productName: "Test Jacket",
            productImage: "/x.jpg",
            colour: "Black",
            size: "M",
            unitPriceCents: 20000,
            currency: "GBP",
            quantity: 1,
          },
        ],
      },
      shipments: {
        create: [
          {
            carrier: "ROYAL_MAIL",
            trackingNumber: "AB123456789GB",
            shippedAt: new Date("2026-04-30T12:00:00Z"),
          },
        ],
      },
      events: {
        create: [
          { status: "NEW", note: null },
          { status: "PROCESSING", note: "label generated" },
          { status: "SHIPPED", note: "first parcel out" },
        ],
      },
    },
    include: { user: true },
  });
  return { user, order };
}

beforeEach(async () => {
  for (const k of Object.keys(_testCookies)) delete _testCookies[k];
  mockSession.mockReset();
  mockSession.mockResolvedValue(null);
  await resetDb();
});

describe("getCustomerOrderById", () => {
  it("returns the order with shipments + events when valid order-token cookie matches", async () => {
    const { order } = await seedOrderWithShipmentAndEvents();
    _testCookies["__ynot_order_token"] = signOrderToken(order.id, order.createdAt);

    const result = await getCustomerOrderById(order.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
    expect(result!.shipments).toHaveLength(1);
    expect(result!.shipments[0].trackingNumber).toBe("AB123456789GB");
    expect(result!.events).toHaveLength(3);
    expect(result!.events.map((e) => e.status)).toEqual([
      "NEW",
      "PROCESSING",
      "SHIPPED",
    ]);
  });

  it("returns the order when the signed-in session owns it", async () => {
    const { user, order } = await seedOrderWithShipmentAndEvents({
      ownerEmail: "owner@example.com",
    });
    mockSession.mockResolvedValue({
      id: user.id,
      email: user.email,
      name: null,
      role: "CUSTOMER",
      emailVerifiedAt: null,
    });

    const result = await getCustomerOrderById(order.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
  });

  it("returns null when no auth and no token", async () => {
    const { order } = await seedOrderWithShipmentAndEvents();
    const result = await getCustomerOrderById(order.id);
    expect(result).toBeNull();
  });

  it("returns null when the order does not exist", async () => {
    expect(await getCustomerOrderById("nonexistent")).toBeNull();
  });

  it("can resolve by orderNumber as well as cuid", async () => {
    const { order } = await seedOrderWithShipmentAndEvents();
    _testCookies["__ynot_order_token"] = signOrderToken(order.id, order.createdAt);

    const result = await getCustomerOrderById(order.orderNumber);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(order.id);
  });
});
