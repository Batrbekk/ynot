import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface OrderDeliveredProps {
  orderNumber: string;
  customerName: string;
  reviewUrl: string;
}

export function OrderDelivered(p: OrderDeliveredProps) {
  return (
    <EmailLayout previewText={`Order ${p.orderNumber} delivered`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        It arrived.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, your order ${p.orderNumber} has been delivered. We hope it's exactly what you were waiting for.`}
      </Text>
      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: "0 0 16px" }}>Would you share what you think? Leave a review.</Text>
        <Button
          href={p.reviewUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
          }}
        >
          Leave a review
        </Button>
      </Section>
    </EmailLayout>
  );
}
