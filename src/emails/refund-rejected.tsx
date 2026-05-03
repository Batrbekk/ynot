import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface RefundRejectedProps {
  returnNumber: string;
  orderNumber: string;
  customerName: string;
  rejectionReason: string;
  inspectionNotes: string;
}

export function RefundRejected(p: RefundRejectedProps) {
  return (
    <EmailLayout previewText={`Update on your return ${p.returnNumber}`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        About your return.
      </Heading>
      <Text>
        {`Hi ${p.customerName}, thank you for sending back return ${p.returnNumber} (from order ${p.orderNumber}). After inspecting it, we're not able to issue a refund this time, and we wanted to explain why.`}
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
          Reason
        </Text>
        <Text style={{ margin: 0 }}>{p.rejectionReason}</Text>
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
          Inspection notes
        </Text>
        <Text style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.inspectionNotes}</Text>
      </Section>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {"If you'd like to discuss this further or have us return the items to you, please reply to this email or write to "}
          <a
            href={`mailto:hello@ynotlondon.com?subject=Return%20${encodeURIComponent(p.returnNumber)}`}
            style={{ color: "#111" }}
          >
            hello@ynotlondon.com
          </a>
          {" — we read every message."}
        </Text>
      </Section>
    </EmailLayout>
  );
}
