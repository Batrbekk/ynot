import { Button, Heading, Img, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface AbandonedCart1hProps {
  customerName?: string;
  items: Array<{ name: string; image: string; priceCents: number; qty: number }>;
  cartUrl: string;
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function AbandonedCart1h(p: AbandonedCart1hProps) {
  const greeting = p.customerName ? `Hi ${p.customerName},` : "Hi,";
  return (
    <EmailLayout previewText="You left something behind">
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Still thinking it over?
      </Heading>
      <Text>
        {`${greeting} the items below are still in your cart. We've saved them for you.`}
      </Text>

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
          Return to your cart
        </Button>
      </Section>
    </EmailLayout>
  );
}
