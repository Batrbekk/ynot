import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface PasswordResetProps {
  customerName?: string;
  /** Either a reset code (current Phase 3 flow) or a resetUrl. */
  resetCode?: string;
  resetUrl?: string;
  expiresInMinutes: number;
}

export function PasswordReset(p: PasswordResetProps) {
  const greeting = p.customerName ? `Hi ${p.customerName},` : "Hi,";
  return (
    <EmailLayout previewText="Reset your YNOT London password">
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Reset your password.
      </Heading>
      <Text>{greeting}</Text>
      <Text>
        We received a request to reset the password on your YNOT London account. Use the code or
        link below to set a new one.
      </Text>

      {p.resetCode && (
        <Section
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #111",
            textAlign: "center",
          }}
        >
          <Text style={{ margin: "0 0 4px", fontSize: 12, color: "#666", letterSpacing: "0.1em" }}>
            RESET CODE
          </Text>
          <Text
            style={{
              margin: 0,
              fontFamily: "Playfair Display, Georgia, serif",
              fontSize: 28,
              letterSpacing: "0.2em",
            }}
          >
            {p.resetCode}
          </Text>
        </Section>
      )}

      {p.resetUrl && (
        <Section style={{ marginTop: 24 }}>
          <Button
            href={p.resetUrl}
            style={{
              background: "#111",
              color: "#fff",
              padding: "12px 24px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Reset password
          </Button>
          <Text style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            {`Or paste this URL into your browser: ${p.resetUrl}`}
          </Text>
        </Section>
      )}

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {`This ${p.resetCode ? "code" : "link"} expires in ${p.expiresInMinutes} minutes. If you did not request a password reset, you can safely ignore this email.`}
        </Text>
      </Section>
    </EmailLayout>
  );
}
