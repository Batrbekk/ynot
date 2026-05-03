import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface VerifyEmailProps {
  customerName?: string;
  /** Either a verification code (current Phase 3 flow) or a verifyUrl. */
  verificationCode?: string;
  verifyUrl?: string;
  expiresInMinutes: number;
}

export function VerifyEmail(p: VerifyEmailProps) {
  const greeting = p.customerName ? `Hi ${p.customerName},` : "Welcome to YNOT London.";
  return (
    <EmailLayout previewText="Verify your email — YNOT London">
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Verify your email.
      </Heading>
      <Text>{greeting}</Text>
      <Text>{`Use the code or link below to confirm your email address.`}</Text>

      {p.verificationCode && (
        <Section
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #111",
            textAlign: "center",
          }}
        >
          <Text style={{ margin: "0 0 4px", fontSize: 12, color: "#666", letterSpacing: "0.1em" }}>
            VERIFICATION CODE
          </Text>
          <Text
            style={{
              margin: 0,
              fontFamily: "Playfair Display, Georgia, serif",
              fontSize: 28,
              letterSpacing: "0.2em",
            }}
          >
            {p.verificationCode}
          </Text>
        </Section>
      )}

      {p.verifyUrl && (
        <Section style={{ marginTop: 24 }}>
          <Button
            href={p.verifyUrl}
            style={{
              background: "#111",
              color: "#fff",
              padding: "12px 24px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Verify email
          </Button>
          <Text style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            {`Or paste this URL into your browser: ${p.verifyUrl}`}
          </Text>
        </Section>
      )}

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {`This ${p.verificationCode ? "code" : "link"} expires in ${p.expiresInMinutes} minutes. If you didn't request it, please ignore this email.`}
        </Text>
      </Section>
    </EmailLayout>
  );
}
