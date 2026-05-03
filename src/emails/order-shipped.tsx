import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface OrderShippedProps {
  orderNumber: string;
  customerName: string;
  carrier: "ROYAL_MAIL" | "DHL";
  trackingNumber: string;
  trackingUrl: string;
  estimatedDelivery?: string;
  itemsCount: number;
}

const CARRIER_LABEL: Record<OrderShippedProps["carrier"], string> = {
  ROYAL_MAIL: "Royal Mail",
  DHL: "DHL Express",
};

export function OrderShipped(p: OrderShippedProps) {
  const itemNoun = p.itemsCount > 1 ? "items" : "item";
  return (
    <EmailLayout previewText={`Order ${p.orderNumber} on the way`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Your order is on the way.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, ${p.itemsCount} ${itemNoun} from order ${p.orderNumber} have been despatched via ${CARRIER_LABEL[p.carrier]}.`}
      </Text>
      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0 }}>{`Tracking number: ${p.trackingNumber}`}</Text>
        {p.estimatedDelivery && (
          <Text style={{ margin: "4px 0 0", color: "#666" }}>
            {`Estimated delivery: ${p.estimatedDelivery}`}
          </Text>
        )}
      </Section>
      <Section style={{ marginTop: 24 }}>
        <Button
          href={p.trackingUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Track your parcel
        </Button>
      </Section>
    </EmailLayout>
  );
}
