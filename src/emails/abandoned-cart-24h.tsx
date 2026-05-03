import { Button, Heading, Img, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface AbandonedCart24hProps {
  customerName?: string;
  items: Array<{ name: string; image: string; priceCents: number; qty: number }>;
  cartUrl: string;
  promoCode: string;
  promoExpiresAt: string;
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function AbandonedCart24h(p: AbandonedCart24hProps) {
  const greeting = p.customerName ? `Hi ${p.customerName},` : "Hi,";
  return (
    <EmailLayout previewText="Your cart, plus 10% off">
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        We saved your cart — and 10% off.
      </Heading>
      <Text>
        {`${greeting} the items below are still waiting. Here's a small thank-you to help finish things off.`}
      </Text>

      <Section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #111",
          textAlign: "center",
        }}
      >
        <Text style={{ margin: "0 0 4px", fontSize: 12, color: "#666", letterSpacing: "0.1em" }}>
          USE CODE
        </Text>
        <Text
          style={{
            margin: 0,
            fontFamily: "Playfair Display, Georgia, serif",
            fontSize: 24,
            letterSpacing: "0.1em",
          }}
        >
          {p.promoCode}
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          {`10% off your cart — expires ${p.promoExpiresAt}`}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        {p.items.map((it, i) => (
          <Section key={i} style={{ marginBottom: 16 }}>
            <Img
              src={it.image}
              alt={it.name}
              width="120"
              height="160"
              style={{
                display: "block",
                border: "1px solid #e5e5e5",
                marginBottom: 8,
              }}
            />
            <Text style={{ margin: 0 }}>
              {`${it.name} × ${it.qty} — ${fmt(it.priceCents * it.qty)}`}
            </Text>
          </Section>
        ))}
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Button
          href={p.cartUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Apply 10% off and check out
        </Button>
      </Section>
    </EmailLayout>
  );
}
