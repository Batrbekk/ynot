import { AnnouncementBar } from "@/components/announcement-bar";
import { ProductCard } from "@/components/product-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Display, Eyebrow } from "@/components/ui/typography";

export const metadata = {
  title: "UI Kit · YNOT London",
};

const COLORS = [
  { name: "foreground-primary", value: "#1A1A1A", className: "bg-foreground-primary" },
  { name: "foreground-secondary", value: "#666666", className: "bg-foreground-secondary" },
  { name: "foreground-tertiary", value: "#999999", className: "bg-foreground-tertiary" },
  { name: "foreground-on-cream", value: "#3D3428", className: "bg-foreground-on-cream" },
  { name: "surface-primary", value: "#FFFFFF", className: "bg-surface-primary border border-border-light" },
  { name: "surface-secondary", value: "#F5F0EB", className: "bg-surface-secondary" },
  { name: "surface-dark", value: "#1A1A1A", className: "bg-surface-dark" },
  { name: "surface-announcement", value: "#111111", className: "bg-surface-announcement" },
  { name: "border-light", value: "#E5E5E5", className: "bg-border-light" },
  { name: "border-dark", value: "#333333", className: "bg-border-dark" },
  { name: "accent-gold", value: "#C4A87C", className: "bg-accent-gold" },
  { name: "accent-warm", value: "#8B7355", className: "bg-accent-warm" },
  { name: "success", value: "#27AE60", className: "bg-success" },
  { name: "error", value: "#C0392B", className: "bg-error" },
];

const SAMPLE_PRODUCTS = [
  { name: "Camden Leather Jacket", price: "£890", image: "/sample/jacket-1.svg" },
  { name: "Soho Suede Bomber", price: "£720", image: "/sample/jacket-2.svg", badge: "new" as const },
  { name: "Mayfair Wool Coat", price: "£1,240", image: "/sample/jacket-3.svg" },
  { name: "Notting Cotton Trench", price: "£560", image: "/sample/jacket-4.svg", badge: "pre-order" as const },
];

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-light py-16 first:border-t-0">
      <div className="mb-10 flex flex-col gap-2">
        <Eyebrow>{title}</Eyebrow>
        {caption && (
          <p className="max-w-prose text-[14px] text-foreground-secondary">
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function UIKitPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Container size="wide" className="py-12">
          <Eyebrow>Design system</Eyebrow>
          <Display level="lg" as="h1" className="mt-4">
            UI kit
          </Display>
          <p className="mt-4 max-w-prose text-[15px] text-foreground-secondary">
            Every primitive used across the site, sourced from the YNOT Pencil
            design tokens. Use this page to verify spacing, colour and
            typography before composing screens.
          </p>

          <Section
            title="Typography"
            caption="Playfair Display for editorial headings, Inter for body and UI."
          >
            <div className="flex flex-col gap-8">
              <Display level="xl" as="p">
                YNOT
              </Display>
              <Display level="lg" as="p">
                Urban outerwear, built to endure.
              </Display>
              <Display level="md" as="p">
                Designed to be relied on.
              </Display>
              <Display level="sm" as="p">
                Why not is not a question. It&apos;s how she lives.
              </Display>
              <p className="text-[15px] leading-relaxed text-foreground-primary max-w-prose">
                Body copy — Inter regular at 15px / 1.6 line height. Used for
                product descriptions, static pages and anything narrative.
              </p>
              <p className="text-[13px] leading-relaxed text-foreground-secondary max-w-prose">
                Secondary body — 13px Inter, used for metadata, captions and
                supporting text alongside primary copy.
              </p>
              <Eyebrow>Eyebrow / label · 11px · 0.25em tracking</Eyebrow>
            </div>
          </Section>

          <Section title="Colour tokens" caption="Reference values mirror ynot.pen.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {COLORS.map((c) => (
                <div key={c.name} className="flex flex-col gap-2">
                  <div className={`${c.className} aspect-[4/3] w-full`} />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-foreground-primary">
                      {c.name}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.15em] text-foreground-tertiary">
                      {c.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Buttons"
            caption="Primary CTA matches checkout, hero, sign-in actions. 52px desktop / 48px tablet / 44px small."
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end gap-4">
                <Button size="lg">Shop</Button>
                <Button size="md">See more</Button>
                <Button size="sm">Sign in</Button>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Button variant="outline">Continue shopping</Button>
                <Button variant="ghost">Forgot password</Button>
                <Button variant="link">Initiate a return</Button>
              </div>
              <div className="max-w-sm">
                <Button fullWidth size="lg">
                  Add to bag
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>
                  Disabled outline
                </Button>
              </div>
            </div>
          </Section>

          <Section
            title="Form fields"
            caption="Inline labels with bottom border, used in checkout and account flows."
          >
            <div className="grid max-w-2xl gap-8 md:grid-cols-2">
              <Input label="Email" type="email" placeholder="you@example.com" />
              <Input label="Password" type="password" placeholder="••••••••" />
              <Input
                label="Postal code"
                placeholder="SW1A 1AA"
                hint="Used to estimate delivery."
              />
              <Input
                label="Promo code"
                placeholder="WELCOME10"
                error="This code has expired."
              />
            </div>
          </Section>

          <Section
            title="Product cards"
            caption="Grid card used in collection pages, new arrivals and recommendations."
          >
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              {SAMPLE_PRODUCTS.map((p) => (
                <ProductCard
                  key={p.name}
                  href="#"
                  name={p.name}
                  price={p.price}
                  image={p.image}
                  badge={p.badge}
                />
              ))}
            </div>
          </Section>

          <Section
            title="Brand block"
            caption="Centred editorial statement used on the homepage between hero and grid."
          >
            <div className="bg-surface-secondary px-6 py-24 text-center">
              <Display level="md" as="p" className="mx-auto max-w-3xl text-foreground-on-cream">
                Urban outerwear, built to endure. Designed to be relied on.
              </Display>
              <p className="mx-auto mt-6 max-w-xl text-[14px] uppercase tracking-[0.25em] text-foreground-on-cream">
                Why not is not a question. It&apos;s how she lives.
              </p>
            </div>
          </Section>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
