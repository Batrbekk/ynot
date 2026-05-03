import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface OrderCancelledProps {
  orderNumber: string;
  customerName: string;
  refundAmountCents: number;
  refundEtaDays: number;
  reasonShort: string;
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function OrderCancelled(p: OrderCancelledProps) {
  return (
    <EmailLayout previewText={`Order ${p.orderNumber} cancelled — refund issued`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Your order has been cancelled.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, your order ${p.orderNumber} has been cancelled. We're sorry for the inconvenience.`}
      </Text>
      <Text style={{ color: "#666", fontSize: 13 }}>{`Reason: ${p.reasonShort}`}</Text>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text style={{ margin: "0 0 4px" }}>
          <strong>Refund:</strong> {fmt(p.refundAmountCents)}
        </Text>
        <Text style={{ margin: "8px 0 0", color: "#666", fontSize: 13 }}>
          {`Funds will appear on your card in ${p.refundEtaDays} working day${p.refundEtaDays === 1 ? "" : "s"} (1-3 working days, up to 10 for some banks).`}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {"Questions? Reply to this email or write to "}
          <a
            href={`mailto:hello@ynotlondon.com?subject=Order%20${encodeURIComponent(p.orderNumber)}`}
            style={{ color: "#111" }}
          >
            hello@ynotlondon.com
          </a>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
}
