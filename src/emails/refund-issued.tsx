import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface RefundIssuedProps {
  returnNumber: string;
  orderNumber: string;
  customerName: string;
  refundAmountCents: number;
  items: Array<{ name: string; qty: number; priceCents: number }>;
  refundMethod: "card" | "other";
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function RefundIssued(p: RefundIssuedProps) {
  return (
    <EmailLayout previewText={`Refund issued for ${p.returnNumber}`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        {`Refund of ${fmt(p.refundAmountCents)} issued.`}
      </Heading>
      <Text>
        {`Hi ${p.customerName}, your refund for return ${p.returnNumber} (order ${p.orderNumber}) has been issued.`}
      </Text>

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
          Refunded items
        </Text>
        {p.items.map((it, i) => (
          <Text key={i} style={{ margin: "4px 0" }}>
            {`${it.name} × ${it.qty} — ${fmt(it.priceCents * it.qty)}`}
          </Text>
        ))}
      </Section>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text style={{ margin: "0 0 4px" }}>
          <strong>Total refunded:</strong> {fmt(p.refundAmountCents)}
        </Text>
        {p.refundMethod === "card" ? (
          <Text style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
            Funds will appear on your card in 1-3 working days (up to 10 for some banks).
          </Text>
        ) : (
          <Text style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
            Refund issued to your original payment method. Please allow up to 10 working days.
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
}
