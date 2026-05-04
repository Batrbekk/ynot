import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface AdminAlertLabelFailureProps {
  orderNumber: string;
  shipmentId: string;
  errorMessage: string;
  adminUrl: string;
}

export function AdminAlertLabelFailure(p: AdminAlertLabelFailureProps) {
  return (
    <EmailLayout previewText={`Label failed for order ${p.orderNumber}`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Label generation failed.
      </Heading>
      <Text>
        {`Order ${p.orderNumber} (shipment ${p.shipmentId}) could not have a carrier label generated after retries.`}
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
          Error
        </Text>
        <Text
          style={{
            margin: 0,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            background: "#f5f5f5",
            padding: 12,
          }}
        >
          {p.errorMessage}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Button
          href={p.adminUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Open in admin
        </Button>
      </Section>
    </EmailLayout>
  );
}
