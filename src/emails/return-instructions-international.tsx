import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface ReturnInstructionsInternationalProps {
  returnNumber: string;
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; qty: number }>;
  returnAddress: { line1: string; city: string; postcode: string; country: string };
  shipByDate: string;
}

export function ReturnInstructionsInternational(p: ReturnInstructionsInternationalProps) {
  return (
    <EmailLayout previewText={`Return ${p.returnNumber} — instructions`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Return instructions for international shipments.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, your return ${p.returnNumber} (from order ${p.orderNumber}) is approved. We've attached a customs declaration and your original commercial invoice to this email.`}
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
        <Text style={{ margin: "4px 0" }}>
          1. Print the attached customs declaration PDF and original commercial invoice.
        </Text>
        <Text style={{ margin: "4px 0" }}>2. Pack the items securely with all original tags.</Text>
        <Text style={{ margin: "4px 0" }}>
          3. Attach both documents to the outside of the parcel in a clear pouch.
        </Text>
        <Text style={{ margin: "4px 0" }}>
          {`4. Ship via your local carrier to the address below before ${p.shipByDate}.`}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: "0 0 4px" }}>
          <strong>Important:</strong> declare as &quot;returned merchandise&quot; on the attached
          customs form.
        </Text>
        <Text style={{ margin: "4px 0" }}>
          {`Mark "${p.orderNumber}" clearly on the package exterior so we can match it on arrival.`}
        </Text>
      </Section>

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
          Return address
        </Text>
        <Text style={{ margin: 0 }}>{p.returnAddress.line1}</Text>
        <Text
          style={{ margin: 0 }}
        >{`${p.returnAddress.city} ${p.returnAddress.postcode}`}</Text>
        <Text style={{ margin: 0 }}>{p.returnAddress.country}</Text>
      </Section>
    </EmailLayout>
  );
}
