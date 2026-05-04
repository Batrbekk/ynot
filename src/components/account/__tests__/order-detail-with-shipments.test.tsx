import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  OrderDetailWithShipments,
  type OrderForCustomer,
} from "../order-detail-with-shipments";

function buildOrder(overrides: Partial<OrderForCustomer> = {}): OrderForCustomer {
  return {
    id: "ord_1",
    orderNumber: "YN-2026-00042",
    userId: null,
    status: "SHIPPED",
    subtotalCents: 20000,
    shippingCents: 0,
    discountCents: 0,
    totalCents: 20000,
    currency: "GBP",
    promoCodeId: null,
    carrier: "ROYAL_MAIL",
    trackingNumber: null,
    estimatedDeliveryDate: null,
    shipFirstName: "Ada",
    shipLastName: "Lovelace",
    shipLine1: "1 Maths Way",
    shipLine2: null,
    shipCity: "London",
    shipPostcode: "SW7 5QG",
    shipCountry: "GB",
    shipPhone: "+447000000000",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    referrer: null,
    landingPath: null,
    createdAt: new Date("2026-04-25T10:30:00Z"),
    updatedAt: new Date("2026-04-30T12:00:00Z"),
    items: [
      {
        id: "oi_1",
        orderId: "ord_1",
        productId: null,
        preorderBatchId: null,
        productSlug: "leather-jacket",
        productName: "Leather Jacket",
        productImage: "/jacket.jpg",
        colour: "Black",
        size: "M",
        unitPriceCents: 20000,
        currency: "GBP",
        quantity: 1,
        isPreorder: false,
        shipmentId: null,
      },
    ],
    shipments: [
      {
        id: "shp_1",
        orderId: "ord_1",
        carrier: "ROYAL_MAIL",
        trackingNumber: "AB123456789GB",
        labelStorageKey: null,
        labelGeneratedAt: new Date("2026-04-29T09:00:00Z"),
        shippedAt: new Date("2026-04-30T12:00:00Z"),
        deliveredAt: null,
        cancelledAt: null,
        attemptCount: 0,
        lastAttemptError: null,
        createdAt: new Date("2026-04-29T09:00:00Z"),
        updatedAt: new Date("2026-04-30T12:00:00Z"),
      },
    ],
    events: [
      {
        id: "ev_1",
        orderId: "ord_1",
        status: "NEW",
        note: null,
        createdAt: new Date("2026-04-25T10:30:00Z"),
      },
      {
        id: "ev_2",
        orderId: "ord_1",
        status: "PROCESSING",
        note: "label generated",
        createdAt: new Date("2026-04-29T09:00:00Z"),
      },
      {
        id: "ev_3",
        orderId: "ord_1",
        status: "SHIPPED",
        note: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      },
    ],
    ...overrides,
  };
}

describe("OrderDetailWithShipments", () => {
  it("renders order number, status, total and items", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    expect(screen.getByText(/YN-2026-00042/)).toBeInTheDocument();
    expect(screen.getByTestId("order-status")).toHaveTextContent(/shipped/i);
    expect(screen.getByText(/Leather Jacket/)).toBeInTheDocument();
    expect(screen.getAllByText(/£200(\.|$)/).length).toBeGreaterThan(0);
  });

  it("renders the status timeline in the order events were given", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    const timelineHeading = screen.getByText(/status timeline/i);
    const timeline = timelineHeading.parentElement!;
    const items = timeline.querySelectorAll("li");
    expect(items.length).toBe(3);
    expect(items[0]).toHaveTextContent(/New/);
    expect(items[1]).toHaveTextContent(/Processing/);
    expect(items[2]).toHaveTextContent(/Shipped/);
  });

  it("renders Royal Mail tracking link with the spec URL", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    const link = screen.getByRole("link", { name: /track shipment/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.royalmail.com/track/AB123456789GB",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders DHL tracking link with the spec URL when carrier is DHL", () => {
    const order = buildOrder({
      shipments: [
        {
          ...buildOrder().shipments[0],
          carrier: "DHL",
          trackingNumber: "1234567890",
        },
      ],
    });
    render(<OrderDetailWithShipments order={order} />);
    const link = screen.getByRole("link", { name: /track shipment/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=1234567890",
    );
  });

  it("shows preorder eyebrow on preorder items", () => {
    const order = buildOrder();
    order.items[0].isPreorder = true;
    render(<OrderDetailWithShipments order={order} />);
    expect(
      screen.getByText(/Pre-order — ships in 4-6 weeks/i),
    ).toBeInTheDocument();
  });

  it("shows empty-state for orders with no shipments", () => {
    const order = buildOrder({ shipments: [] });
    render(<OrderDetailWithShipments order={order} />);
    expect(
      screen.getByText(/No shipments yet — your order is being prepared/i),
    ).toBeInTheDocument();
  });
});
