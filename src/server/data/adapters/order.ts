import type { Order as ZodOrder, CartItem as ZodCartItem } from "@/lib/schemas";
import type { OrderWithItems } from "@/server/repositories/order.repo";
import type { OrderItem as PrismaOrderItem } from "@prisma/client";

function carrierToHyphenated(c: "ROYAL_MAIL" | "DHL"): "royal-mail" | "dhl" {
  return c === "ROYAL_MAIL" ? "royal-mail" : "dhl";
}

function toOrderItem(row: PrismaOrderItem): ZodCartItem {
  return {
    productId: row.productId ?? "",
    slug: row.productSlug,
    name: row.productName,
    image: row.productImage,
    colour: row.colour,
    size: row.size,
    unitPrice: row.unitPriceCents,
    quantity: row.quantity,
    preOrder: row.isPreorder,
    orderItemId: row.id,
  };
}

export function toOrder(row: OrderWithItems): ZodOrder {
  return {
    id: row.orderNumber,
    recordId: row.id,
    createdAt: row.createdAt.toISOString(),
    status: row.status.toLowerCase() as ZodOrder["status"],
    items: row.items.map(toOrderItem),
    subtotal: row.subtotalCents,
    shipping: row.shippingCents,
    total: row.totalCents,
    currency: "GBP",
    carrier: carrierToHyphenated(row.carrier),
    trackingNumber: row.trackingNumber,
    shippingAddress: {
      firstName: row.shipFirstName,
      lastName: row.shipLastName,
      line1: row.shipLine1,
      line2: row.shipLine2,
      city: row.shipCity,
      postcode: row.shipPostcode,
      country: row.shipCountry,
      phone: row.shipPhone,
    },
    estimatedDeliveryDate: row.estimatedDeliveryDate
      ? row.estimatedDeliveryDate.toISOString().slice(0, 10)
      : "",
  };
}
