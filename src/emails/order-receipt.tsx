import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface OrderReceiptProps {
  orderNumber: string;
  customerName: string;
  totalCents: number;
  currency: "GBP";
  itemsInStock: Array<{ name: string; size: string; qty: number; priceCents: number }>;
  itemsPreorder: Array<{
    name: string;
    size: string;
    qty: number;
    priceCents: number;
    batchEtaWeeks: number;
  }>;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  estimatedShipFrom?: string;
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function OrderReceipt(p: OrderReceiptProps) {
  return (
    <EmailLayout previewText={`Order ${p.orderNumber} confirmed`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Thank you, {p.customerName}.
      </Heading>
      <Text>
        Your order <strong>{p.orderNumber}</strong> has been received. We&apos;ll email you again
        as soon as your items are on the way.
      </Text>

      {p.itemsInStock.length > 0 && (
        <Section style={{ marginTop: 24 }}>
          <Text
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#666",
              margin: "0 0 8px",
            }}
          >
            Shipping now
          </Text>
          {p.itemsInStock.map((it, i) => (
            <Text key={i} style={{ margin: "4px 0" }}>
              {it.name} — Size {it.size} × {it.qty} — {fmt(it.priceCents * it.qty)}
            </Text>
          ))}
        </Section>
      )}

      {p.itemsPreorder.length > 0 && (
        <Section style={{ marginTop: 24 }}>
          <Text
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#666",
              margin: "0 0 8px",
            }}
          >
            {`Pre-order — ships in ${p.itemsPreorder[0].batchEtaWeeks} weeks`}
          </Text>
          {p.itemsPreorder.map((it, i) => (
            <Text key={i} style={{ margin: "4px 0" }}>
              {it.name} — Size {it.size} × {it.qty} — {fmt(it.priceCents * it.qty)}
            </Text>
          ))}
        </Section>
      )}

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text style={{ margin: "0 0 4px" }}>
          <strong>Total:</strong> {fmt(p.totalCents)}
        </Text>
        <Text style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
          Shipping to: {p.shippingAddress.line1}
          {p.shippingAddress.line2 ? `, ${p.shippingAddress.line2}` : ""}, {p.shippingAddress.city}{" "}
          {p.shippingAddress.postcode}, {p.shippingAddress.country}
        </Text>
        {p.estimatedShipFrom && (
          <Text style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
            Estimated to ship from {p.estimatedShipFrom}.
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
}
