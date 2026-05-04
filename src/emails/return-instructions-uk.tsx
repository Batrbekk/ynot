import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface ReturnInstructionsUkProps {
  returnNumber: string;
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; qty: number }>;
  shipByDate: string;
}

export function ReturnInstructionsUk(p: ReturnInstructionsUkProps) {
  return (
    <EmailLayout previewText={`Return ${p.returnNumber} — your prepaid label`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Your prepaid return label is attached.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, your return ${p.returnNumber} (from order ${p.orderNumber}) is approved. We've attached a prepaid Royal Mail label to this email.`}
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
          Items in this return
        </Text>
        {p.items.map((it, i) => (
          <Text key={i} style={{ margin: "4px 0" }}>
            {`${it.name} × ${it.qty}`}
          </Text>
        ))}
      </Section>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#666",
            margin: "0 0 8px",
          }}
        >
          Steps
        </Text>
        <Text style={{ margin: "4px 0" }}>1. Print the attached PDF label.</Text>
        <Text style={{ margin: "4px 0" }}>
          2. Pack the items securely with all original tags attached.
        </Text>
        <Text style={{ margin: "4px 0" }}>
          {`3. Drop the parcel at any post office or postbox before ${p.shipByDate}.`}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {`Please ship by ${p.shipByDate}. If we don't receive your return within 14 days we may not be able to process the refund.`}
        </Text>
      </Section>
    </EmailLayout>
  );
}
