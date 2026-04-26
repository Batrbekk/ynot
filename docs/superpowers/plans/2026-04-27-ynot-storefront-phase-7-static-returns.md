# YNOT Storefront — Phase 7: Static pages + Returns + 404 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Ship the remaining informational/utility surface — Our Story, Product Care, Sustainability, Shipping & Returns, Privacy, Contact — plus the 3-step Initiate Return flow and a branded 404. Closes the user-facing route inventory; the only thing missing after Phase 7 is SEO polish (Phase 8) and animations (Phase 9).

**Architecture:** Each static page is a Server Component composing chrome + Container + page-specific structured blocks (PageHero, ValueCallouts, StatsBlock, PullQuote, ShippingTable, CareTabContent). Content lives in code (not CMS yet) since the design has rich structured layouts that don't fit pure markdown. Privacy and Contact use the existing Prose primitive. Returns flow uses URL `?step=` parameter to drive the wizard, with a small `useReturnsStub` Zustand store carrying order id + selected items between steps.

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Zustand 5, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § Static, § Returns, § 404.

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-7-static-returns` (NEW worktree).

**Prerequisites in main:** Phases 1-6 (131 tests).

---

## File structure

```
web/
├── src/
│   ├── lib/stores/
│   │   ├── returns-stub-store.ts          [created]
│   │   └── __tests__/
│   │       └── returns-stub-store.test.ts  [created]
│   ├── components/
│   │   ├── static/
│   │   │   ├── page-hero.tsx              [created]
│   │   │   ├── value-callouts.tsx         [created]
│   │   │   ├── stats-block.tsx            [created]
│   │   │   ├── pull-quote.tsx             [created]
│   │   │   ├── shipping-table.tsx         [created]
│   │   │   └── care-tab-content.tsx       [created]
│   │   └── returns/
│   │       ├── return-flow-progress.tsx   [created]
│   │       ├── find-order-form.tsx        [created]
│   │       ├── return-items-selector.tsx  [created]
│   │       └── return-confirmation.tsx    [created]
│   └── app/
│       ├── our-story/page.tsx             [created]
│       ├── product-care/page.tsx          [created]
│       ├── sustainability/page.tsx        [created]
│       ├── shipping-returns/page.tsx      [created]
│       ├── privacy/page.tsx               [created]
│       ├── contact/page.tsx               [created]
│       ├── initiate-return/page.tsx       [created]
│       └── not-found.tsx                  [created]
└── (no other changes)
```

---

# Section A — Worktree

### Task 1

- [ ] **Step 1:**
```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git worktree add .worktrees/phase-7-static-returns -b feature/phase-7-static-returns
```

- [ ] **Step 2:**
```bash
cd .worktrees/phase-7-static-returns
pnpm install --frozen-lockfile
pnpm build
pnpm test
```
Expected: 131 tests pass.

---

# Section B — Static page primitives

### Task 2: PageHero

**Files:** `src/components/static/page-hero.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Image from "next/image";
import { Display, Eyebrow } from "@/components/ui/typography";

export interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  image?: string;
}

export function PageHero({ eyebrow, title, description, image }: PageHeroProps) {
  if (image) {
    return (
      <header className="relative h-[50vh] min-h-[360px] w-full overflow-hidden bg-surface-dark">
        <Image src={image} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
          {eyebrow && <Eyebrow className="text-foreground-inverse mb-4">{eyebrow}</Eyebrow>}
          <Display level="lg" as="h1">{title}</Display>
          {description && (
            <p className="mt-4 max-w-md text-[14px] leading-relaxed">{description}</p>
          )}
        </div>
      </header>
    );
  }
  return (
    <header className="border-b border-border-light py-16 text-center">
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <Display level="lg" as="h1">{title}</Display>
      {description && (
        <p className="mt-4 mx-auto max-w-[640px] text-[14px] text-foreground-secondary">{description}</p>
      )}
    </header>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/page-hero.tsx
git commit -m "feat(static): add PageHero with optional image"
```

---

### Task 3: ValueCallouts

**Files:** `src/components/static/value-callouts.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";

export interface ValueCallout {
  title: string;
  body: string;
}

export function ValueCallouts({ items }: { items: ValueCallout[] }) {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.title} className="flex flex-col gap-3 text-center md:text-left">
          <h3 className="font-heading text-[20px] text-foreground-primary">{it.title}</h3>
          <p className="text-[14px] leading-relaxed text-foreground-secondary">{it.body}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/value-callouts.tsx
git commit -m "feat(static): add ValueCallouts grid (used on Our Story)"
```

---

### Task 4: StatsBlock

**Files:** `src/components/static/stats-block.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";

export interface Stat {
  value: string;
  label: string;
}

export function StatsBlock({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-12 md:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className="font-heading text-[64px] leading-none text-foreground-primary md:text-[80px]">
            {s.value}
          </p>
          <p className="mt-4 text-[12px] uppercase tracking-[0.25em] text-foreground-secondary">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/stats-block.tsx
git commit -m "feat(static): add StatsBlock (3 large stats — Sustainability page)"
```

---

### Task 5: PullQuote

**Files:** `src/components/static/pull-quote.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";

export interface PullQuoteProps {
  quote: string;
  attribution?: string;
}

export function PullQuote({ quote, attribution }: PullQuoteProps) {
  return (
    <blockquote className="mx-auto max-w-3xl text-center px-6">
      <p className="font-heading text-[28px] leading-snug text-foreground-primary md:text-[36px]">
        “{quote}”
      </p>
      {attribution && (
        <footer className="mt-6 text-[12px] uppercase tracking-[0.25em] text-foreground-secondary">
          — {attribution}
        </footer>
      )}
    </blockquote>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/pull-quote.tsx
git commit -m "feat(static): add PullQuote (large centred quote with optional attribution)"
```

---

### Task 6: ShippingTable

**Files:** `src/components/static/shipping-table.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";

export interface ShippingRow {
  destination: string;
  time: string;
  carrier: string;
  cost: string;
}

export function ShippingTable({ rows }: { rows: ShippingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t border-border-light text-left">
        <thead>
          <tr className="border-b border-border-light text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
            <th className="py-4 pr-4 font-medium">Destination</th>
            <th className="py-4 pr-4 font-medium">Delivery time</th>
            <th className="py-4 pr-4 font-medium">Carrier</th>
            <th className="py-4 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.destination} className="border-b border-border-light text-[14px]">
              <td className="py-4 pr-4">{r.destination}</td>
              <td className="py-4 pr-4">{r.time}</td>
              <td className="py-4 pr-4">{r.carrier}</td>
              <td className="py-4">{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/shipping-table.tsx
git commit -m "feat(static): add ShippingTable for Shipping & Returns page"
```

---

### Task 7: CareTabContent

**Files:** `src/components/static/care-tab-content.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";

export interface CareSection {
  title: string;
  body: string;
}

export interface CareTabContentProps {
  intro: string;
  sections: CareSection[];
}

export function CareTabContent({ intro, sections }: CareTabContentProps) {
  return (
    <div className="flex flex-col gap-10">
      <p className="text-[15px] leading-relaxed text-foreground-primary max-w-[720px]">
        {intro}
      </p>
      <div className="grid gap-10 md:grid-cols-3">
        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">
              {s.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-foreground-primary">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/static/care-tab-content.tsx
git commit -m "feat(static): add CareTabContent (intro + 3 sections per material tab)"
```

---

# Section C — Static pages

### Task 8: /our-story

**Files:** `src/app/our-story/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { ValueCallouts } from "@/components/static/value-callouts";
import { PullQuote } from "@/components/static/pull-quote";

export const metadata = {
  title: "Our Story · YNOT London",
  description: "Premium women's outerwear designed in London — built to endure, designed to be relied on.",
};

const VALUES = [
  { title: "Timeless design", body: "Pieces designed to transcend seasons and trends — wardrobe foundations rather than fast fashion." },
  { title: "Premium materials", body: "Leather, suede, wool, cotton and Tencel — sourced with integrity from heritage suppliers." },
  { title: "Sustainability", body: "0% leather waste in production. Responsible sourcing practices throughout the supply chain." },
  { title: "London & Istanbul", body: "Designed in our London studio. Made by skilled craftspeople between London and Istanbul." },
];

export default function OurStoryPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Our Story"
          title="Why Not?"
          image="/cms/our-story/hero.jpg"
        />

        <Section padding="lg">
          <Container size="narrow">
            <div className="flex flex-col gap-6 text-[16px] leading-relaxed text-foreground-primary">
              <p>
                YNOT London was born from a simple belief: outerwear should be as resilient as the women who wear it. Our name carries a quiet philosophy — why not live boldly, dress intentionally, and choose pieces that endure.
              </p>
              <p>
                Every silhouette in our collection is engineered for movement, designed for everyday wear, and constructed to last beyond a single season. We work with materials chosen for their character — leather that softens, wool that insulates, cotton that breathes — and finish each piece with hardware made to outlive trends.
              </p>
            </div>
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="wide">
            <Display level="md" as="h2" className="text-center mb-12 text-foreground-on-cream">
              What we stand for
            </Display>
            <ValueCallouts items={VALUES} />
          </Container>
        </Section>

        <Section padding="lg">
          <Container size="wide">
            <PullQuote
              quote="Urban outerwear, built to endure. Designed to be relied on."
              attribution="YNOT London"
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/our-story/page.tsx
git commit -m "feat(static): add /our-story page with hero + narrative + values + pull-quote"
```

---

### Task 9: /sustainability

**Files:** `src/app/sustainability/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { StatsBlock } from "@/components/static/stats-block";

export const metadata = {
  title: "Sustainability · YNOT London",
  description: "Our approach to sustainability and animal welfare — by-product sourcing, LWG certification, zero waste production.",
};

const STATS = [
  { value: "0%", label: "Leather waste" },
  { value: "100%", label: "By-product sourcing" },
  { value: "LWG", label: "Certified partners" },
];

const APPROACHES = [
  {
    title: "By-product sourcing",
    body: "All leather used in YNOT products is a by-product of the food industry. We ensure that no animal is raised or harmed for the sole purpose of leather production.",
  },
  {
    title: "LWG certification",
    body: "We partner exclusively with tanneries certified by the Leather Working Group, ensuring the highest standards in environmental management, water treatment, and energy efficiency.",
  },
  {
    title: "Zero waste production",
    body: "Our cutting process is optimised to achieve 0% leather waste. Offcuts are repurposed for smaller accessories or returned to suppliers for use in other products.",
  },
  {
    title: "Responsible fibres",
    body: "We use Tencel, a sustainably sourced wood fibre, alongside responsibly produced wool and organic cotton. Every material is chosen with the planet in mind.",
  },
];

export default function SustainabilityPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Sustainability & Animal Welfare"
          title="Responsibility, woven in."
          description="At YNOT London, sustainability isn't a trend — it's a responsibility. We believe that creating beautiful outerwear shouldn't come at the cost of the planet."
        />

        <Section padding="lg">
          <Container size="wide">
            <StatsBlock stats={STATS} />
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="wide">
            <Display level="md" as="h2" className="text-center mb-16 text-foreground-on-cream">
              Our approach
            </Display>
            <div className="grid gap-12 md:grid-cols-2 md:gap-16">
              {APPROACHES.map((a) => (
                <article key={a.title} className="flex flex-col gap-3">
                  <h3 className="font-heading text-[24px] text-foreground-on-cream">{a.title}</h3>
                  <p className="text-[15px] leading-relaxed text-foreground-on-cream">{a.body}</p>
                </article>
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/sustainability/page.tsx
git commit -m "feat(static): add /sustainability page with stats + 4 approaches"
```

---

### Task 10: /product-care

**Files:** `src/app/product-care/page.tsx`.

- [ ] **Step 1:** Implement (uses Tabs primitive from Phase 1):

```tsx
"use client";

import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { PageHero } from "@/components/static/page-hero";
import { CareTabContent } from "@/components/static/care-tab-content";

const MATERIALS = [
  {
    value: "leather",
    label: "Leather",
    intro: "Leather is a natural material that develops a beautiful patina over time. With proper care, your YNOT leather piece will last for years and only get better with age.",
    sections: [
      { title: "Cleaning", body: "Wipe with a soft, damp cloth. Use specialist leather cleaner for stubborn marks. Never use harsh chemicals or abrasive materials." },
      { title: "Protection", body: "Apply leather conditioner every 6 months to maintain suppleness. Avoid direct sunlight and heat sources for prolonged periods." },
      { title: "Storage", body: "Store on a padded hanger in a breathable garment bag. Keep in a cool, dry place away from direct sunlight. Never fold leather garments." },
    ],
  },
  {
    value: "shearling",
    label: "Shearling",
    intro: "Shearling is a luxurious natural material that requires gentle care to retain its softness, warmth, and longevity.",
    sections: [
      { title: "Cleaning", body: "Spot clean only. For deep cleaning, use a specialist shearling cleaner — never machine wash or dry clean conventionally." },
      { title: "Protection", body: "Brush gently with a suede brush to maintain texture. Avoid prolonged exposure to rain or moisture." },
      { title: "Storage", body: "Hang on a wide padded hanger to maintain shape. Store in a cool, dry place. Use a garment bag if storing for an extended period." },
    ],
  },
  {
    value: "suede",
    label: "Suede",
    intro: "Suede is delicate but durable when cared for properly. Regular brushing and prompt stain treatment keep your piece looking its best.",
    sections: [
      { title: "Cleaning", body: "Use a suede brush to remove dust and revive nap. For stains, blot immediately with a clean cloth and use a suede eraser." },
      { title: "Protection", body: "Apply a suede protector spray before first wear and after cleaning. Avoid wearing in heavy rain." },
      { title: "Storage", body: "Hang on a padded hanger in a breathable garment bag. Stuff sleeves with tissue to maintain shape." },
    ],
  },
  {
    value: "wool",
    label: "Wool",
    intro: "Wool is naturally resilient, breathable, and warm. With minimal care, your wool piece will serve you for many seasons.",
    sections: [
      { title: "Cleaning", body: "Dry clean only. Brush gently with a soft clothes brush after each wear to remove surface dust and debris." },
      { title: "Protection", body: "Air your garment between wears to allow natural fibres to recover. Avoid direct heat when drying." },
      { title: "Storage", body: "Fold and store in a breathable bag with cedar blocks to deter moths. Avoid plastic, which traps moisture." },
    ],
  },
  {
    value: "cotton",
    label: "Cotton",
    intro: "Cotton outerwear is the easiest to care for. Follow the care label for machine washing instructions and your piece will stay fresh wear after wear.",
    sections: [
      { title: "Cleaning", body: "Machine wash cold on a gentle cycle with similar colours. Use a mild detergent — avoid bleach." },
      { title: "Protection", body: "Wash inside-out to preserve colour. Avoid over-drying — remove from the dryer while slightly damp." },
      { title: "Storage", body: "Fold or hang in a dry, ventilated place. Iron on a medium setting if needed." },
    ],
  },
];

export default function ProductCarePage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow="Product Care"
          title="Made to last."
          description="Keep your YNOT pieces looking their best with these care instructions. Select a material to view detailed guidance."
        />

        <Section padding="lg">
          <Container size="wide">
            <Tabs
              items={MATERIALS.map((m) => ({
                value: m.value,
                label: m.label,
                content: <CareTabContent intro={m.intro} sections={m.sections} />,
              }))}
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/product-care/page.tsx
git commit -m "feat(static): add /product-care page with material tabs"
```

---

### Task 11: /shipping-returns

**Files:** `src/app/shipping-returns/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/static/page-hero";
import { ShippingTable } from "@/components/static/shipping-table";

const ROWS = [
  { destination: "United Kingdom", time: "2–3 business days", carrier: "Royal Mail", cost: "Free" },
  { destination: "Worldwide", time: "8–10 business days", carrier: "DHL", cost: "Free" },
];

const RETURN_BULLETS = [
  "Items must be returned within 14 days of delivery",
  "All original tags and packaging must be intact",
  "Items must be unworn and in original condition",
  "Refunds are processed within 5–7 business days",
];

export default function ShippingReturnsPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Shipping & Returns" title="Free shipping. Easy returns." />

        <Section padding="lg">
          <Container size="wide">
            <Tabs
              items={[
                {
                  value: "delivery",
                  label: "Delivery",
                  content: (
                    <div className="flex flex-col gap-8">
                      <p className="text-[15px] text-foreground-primary max-w-[640px]">
                        We offer free shipping worldwide. Orders are dispatched from our London warehouse within 1–2 business days.
                      </p>
                      <ShippingTable rows={ROWS} />
                    </div>
                  ),
                },
                {
                  value: "returns",
                  label: "Returns",
                  content: (
                    <div className="flex flex-col gap-8 max-w-[640px]">
                      <p className="text-[15px] text-foreground-primary">
                        We accept returns within 14 days of delivery. Items must be unworn, in original condition with all tags attached.
                      </p>
                      <ul className="flex flex-col gap-3 text-[14px] text-foreground-primary">
                        {RETURN_BULLETS.map((b) => (
                          <li key={b} className="flex gap-3">
                            <span aria-hidden className="text-accent-warm">·</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/initiate-return" className="self-start">
                        <Button>Start your return</Button>
                      </Link>
                    </div>
                  ),
                },
              ]}
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/shipping-returns/page.tsx
git commit -m "feat(static): add /shipping-returns page with Delivery + Returns tabs"
```

---

### Task 12: /privacy

**Files:** `src/app/privacy/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Prose } from "@/components/ui/prose";
import { PageHero } from "@/components/static/page-hero";

export const metadata = {
  title: "Privacy Policy · YNOT London",
  description: "How YNOT London handles your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Legal" title="Privacy Policy" />
        <Section padding="lg">
          <Container size="narrow">
            <Prose>
              <p>This policy describes how YNOT London (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and protects your personal data when you visit ynotlondon.com or place an order with us.</p>

              <h2>What we collect</h2>
              <p>We collect the information you give us when you create an account, place an order, or contact us — including your name, email, shipping address, phone number, and payment details (processed securely by Stripe).</p>
              <p>We also collect technical data automatically: IP address, browser type, device, and pages you view, via cookies and similar technologies.</p>

              <h2>How we use it</h2>
              <ul>
                <li>To process and fulfil your orders</li>
                <li>To send you order confirmations and shipping updates</li>
                <li>To improve our website and your shopping experience</li>
                <li>To send marketing emails (only if you&rsquo;ve opted in)</li>
              </ul>

              <h2>Sharing</h2>
              <p>We share your data with trusted partners only when necessary — Stripe for payment processing, Royal Mail and DHL for delivery, and our email provider for transactional messages. We never sell your data.</p>

              <h2>Your rights</h2>
              <p>You can access, correct, or delete your personal data at any time. Contact us at hello@ynotlondon.com for any data requests.</p>

              <h2>Cookies</h2>
              <p>We use essential cookies to operate the site and analytics cookies to understand how visitors use it. You can manage your cookie preferences via the banner at the bottom of the page.</p>

              <p className="text-[12px] text-foreground-tertiary mt-12">Last updated: 1 April 2026.</p>
            </Prose>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/privacy/page.tsx
git commit -m "feat(static): add /privacy page with prose layout"
```

---

### Task 13: /contact

**Files:** `src/app/contact/page.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/static/page-hero";

export const metadata = {
  title: "Contact · YNOT London",
  description: "Get in touch with YNOT London.",
};

export default function ContactPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Get in touch" title="We'd love to hear from you." />

        <Section padding="lg">
          <Container size="narrow">
            <div className="grid gap-12 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Customer care</h2>
                <a href="mailto:hello@ynotlondon.com" className="font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary">
                  hello@ynotlondon.com
                </a>
                <p className="text-[14px] text-foreground-secondary">Response within 24 hours, Monday to Friday.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Studio</h2>
                <p className="text-[14px] leading-relaxed text-foreground-primary">
                  YNOT London<br />
                  London, United Kingdom
                </p>
                <p className="text-[14px] text-foreground-secondary">By appointment only.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">WhatsApp</h2>
                <p className="text-[14px] text-foreground-primary">Tap the floating WhatsApp button at the bottom of any page for the fastest response.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Press</h2>
                <a href="mailto:press@ynotlondon.com" className="font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary">
                  press@ynotlondon.com
                </a>
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/contact/page.tsx
git commit -m "feat(static): add /contact page with email + studio info"
```

---

# Section D — Returns flow

### Task 14: returns stub store

**Files:** `src/lib/stores/returns-stub-store.ts`, `src/lib/stores/__tests__/returns-stub-store.test.ts`.

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useReturnsStubStore } from "../returns-stub-store";

beforeEach(() => {
  useReturnsStubStore.setState({ orderId: null, selectedItems: [], reason: "" });
});

describe("returns stub store", () => {
  it("starts empty", () => {
    expect(useReturnsStubStore.getState().orderId).toBeNull();
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
  });

  it("setOrder stores id and resets selection", () => {
    useReturnsStubStore.setState({ selectedItems: ["x"] });
    useReturnsStubStore.getState().setOrder("YNT-2847");
    expect(useReturnsStubStore.getState().orderId).toBe("YNT-2847");
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
  });

  it("toggleItem adds and removes", () => {
    useReturnsStubStore.getState().toggleItem("a");
    useReturnsStubStore.getState().toggleItem("b");
    expect(useReturnsStubStore.getState().selectedItems).toEqual(["a", "b"]);
    useReturnsStubStore.getState().toggleItem("a");
    expect(useReturnsStubStore.getState().selectedItems).toEqual(["b"]);
  });

  it("setReason updates the reason", () => {
    useReturnsStubStore.getState().setReason("doesn't fit");
    expect(useReturnsStubStore.getState().reason).toBe("doesn't fit");
  });

  it("reset clears everything", () => {
    useReturnsStubStore.getState().setOrder("X");
    useReturnsStubStore.getState().toggleItem("a");
    useReturnsStubStore.getState().setReason("x");
    useReturnsStubStore.getState().reset();
    expect(useReturnsStubStore.getState().orderId).toBeNull();
    expect(useReturnsStubStore.getState().selectedItems).toEqual([]);
    expect(useReturnsStubStore.getState().reason).toBe("");
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import { create } from "zustand";

interface ReturnsState {
  orderId: string | null;
  selectedItems: string[];
  reason: string;
  setOrder: (id: string) => void;
  toggleItem: (id: string) => void;
  setReason: (reason: string) => void;
  reset: () => void;
}

export const useReturnsStubStore = create<ReturnsState>()((set, get) => ({
  orderId: null,
  selectedItems: [],
  reason: "",

  setOrder: (id) => set({ orderId: id, selectedItems: [], reason: "" }),

  toggleItem: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((x) => x !== id)
        : [...state.selectedItems, id],
    })),

  setReason: (reason) => set({ reason }),

  reset: () => set({ orderId: null, selectedItems: [], reason: "" }),
}));
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/stores/returns-stub-store.ts src/lib/stores/__tests__/returns-stub-store.test.ts
git commit -m "feat(state): add returns stub store (orderId + selected items + reason)"
```

---

### Task 15: ReturnFlowProgress

**Files:** `src/components/returns/return-flow-progress.tsx`.

- [ ] **Step 1:** Implement (mirrors CheckoutProgress pattern):

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  { num: 1, label: "Find order" },
  { num: 2, label: "Select items" },
  { num: 3, label: "Confirm" },
] as const;

export interface ReturnFlowProgressProps {
  current: 1 | 2 | 3;
}

export function ReturnFlowProgress({ current }: ReturnFlowProgressProps) {
  return (
    <ol className="flex items-center gap-4 md:gap-6">
      {STEPS.map((s, i) => {
        const active = current === s.num;
        const done = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <li className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  active && "bg-foreground-primary text-foreground-inverse",
                  done && "bg-foreground-primary text-foreground-inverse",
                  !active && !done && "border border-border-dark text-foreground-secondary",
                )}
              >
                {done ? "✓" : s.num}
              </span>
              <span
                className={cn(
                  "text-[12px] uppercase tracking-[0.2em]",
                  active ? "text-foreground-primary" : "text-foreground-secondary",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border-dark md:w-12" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/returns/return-flow-progress.tsx
git commit -m "feat(returns): add ReturnFlowProgress 1-2-3 indicator"
```

---

### Task 16: FindOrderForm

**Files:** `src/components/returns/find-order-form.tsx`.

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FindOrderFormProps {
  onSubmit: (orderNumber: string, contact: string) => void;
  error?: string;
}

export function FindOrderForm({ onSubmit, error }: FindOrderFormProps) {
  const [orderNumber, setOrderNumber] = React.useState("");
  const [contact, setContact] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !contact) return;
    onSubmit(orderNumber.trim(), contact.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-[480px]">
      <p className="text-[14px] text-foreground-secondary">
        Enter your order number and email or postcode to find your order and start the return process.
      </p>
      <Input
        label="Order number"
        placeholder="e.g. YNT-20260414-0029"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        required
      />
      <Input
        label="Email address or postcode"
        placeholder="email@example.com"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        error={error}
        required
      />
      <Button type="submit" size="lg" fullWidth>Find my order</Button>
      <p className="text-[12px] text-foreground-tertiary">
        Can&rsquo;t find your order number? Check your confirmation email or contact us.
      </p>
    </form>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/returns/find-order-form.tsx
git commit -m "feat(returns): add FindOrderForm (step 1)"
```

---

### Task 17: ReturnItemsSelector

**Files:** `src/components/returns/return-items-selector.tsx`.

- [ ] **Step 1:** Implement:

```tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/schemas";

export interface ReturnItemsSelectorProps {
  order: Order;
  selectedKeys: string[];
  reason: string;
  onToggle: (key: string) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

const itemKey = (i: { productId: string; size: string }) => `${i.productId}-${i.size}`;

export function ReturnItemsSelector({
  order,
  selectedKeys,
  reason,
  onToggle,
  onReasonChange,
  onSubmit,
}: ReturnItemsSelectorProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedKeys.length === 0 || !reason.trim()) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary mb-4">
          Order #{order.id}
        </h2>
        <ul className="divide-y divide-border-light border-y border-border-light">
          {order.items.map((item) => {
            const key = itemKey(item);
            return (
              <li key={key} className="flex gap-4 py-4 items-center">
                <Checkbox
                  label=""
                  checked={selectedKeys.includes(key)}
                  onChange={() => onToggle(key)}
                />
                <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
                  <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium">{item.name}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {item.colour} · Size {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-[14px]">{formatPrice(item.unitPrice * item.quantity, "GBP")}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <Textarea
        label="Reason for return"
        placeholder="Tell us why you're returning these items..."
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        required
        rows={4}
      />

      <Button type="submit" size="lg" fullWidth disabled={selectedKeys.length === 0 || !reason.trim()}>
        Continue
      </Button>
    </form>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/returns/return-items-selector.tsx
git commit -m "feat(returns): add ReturnItemsSelector (step 2 with reason)"
```

---

### Task 18: ReturnConfirmation

**Files:** `src/components/returns/return-confirmation.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Display } from "@/components/ui/typography";

export interface ReturnConfirmationProps {
  orderId: string;
  email: string;
  itemCount: number;
}

export function ReturnConfirmation({ orderId, email, itemCount }: ReturnConfirmationProps) {
  return (
    <div className="flex flex-col gap-8 max-w-[640px] text-center mx-auto">
      <Display level="md" as="h1">Return submitted</Display>
      <p className="text-[14px] text-foreground-secondary">
        We&rsquo;ve received your return request for order <strong>#{orderId}</strong> ({itemCount} {itemCount === 1 ? "item" : "items"}).
        A pre-paid return label and instructions have been sent to <strong>{email || "your email"}</strong>.
      </p>

      <div className="border border-border-light p-6 text-left">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary mb-3">
          Next steps
        </h2>
        <ol className="flex flex-col gap-2 text-[14px] text-foreground-primary list-decimal pl-5">
          <li>Print the pre-paid label from the email we sent.</li>
          <li>Pack the items in their original packaging with tags attached.</li>
          <li>Drop off at any Royal Mail post office (UK) or DHL ServicePoint (worldwide).</li>
          <li>You&rsquo;ll receive a refund within 5–7 business days of us receiving the return.</li>
        </ol>
      </div>

      <div className="flex justify-center">
        <Link href="/">
          <Button size="lg">Continue shopping</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/components/returns/return-confirmation.tsx
git commit -m "feat(returns): add ReturnConfirmation (step 3 success)"
```

---

### Task 19: /initiate-return page

**Files:** `src/app/initiate-return/page.tsx`.

- [ ] **Step 1:** Implement (client; uses URL `?step=` to drive wizard, returns store for state):

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { ReturnFlowProgress } from "@/components/returns/return-flow-progress";
import { FindOrderForm } from "@/components/returns/find-order-form";
import { ReturnItemsSelector } from "@/components/returns/return-items-selector";
import { ReturnConfirmation } from "@/components/returns/return-confirmation";
import { useReturnsStubStore } from "@/lib/stores/returns-stub-store";
import { getOrderById } from "@/lib/data/orders";
import type { Order } from "@/lib/schemas";

function InitiateReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const step = (Number(params.get("step")) || 1) as 1 | 2 | 3;

  const orderId = useReturnsStubStore((s) => s.orderId);
  const selectedItems = useReturnsStubStore((s) => s.selectedItems);
  const reason = useReturnsStubStore((s) => s.reason);
  const setOrder = useReturnsStubStore((s) => s.setOrder);
  const toggleItem = useReturnsStubStore((s) => s.toggleItem);
  const setReason = useReturnsStubStore((s) => s.setReason);

  const [order, setOrderObj] = React.useState<Order | null>(null);
  const [findError, setFindError] = React.useState<string | undefined>();
  const [contactEmail, setContactEmail] = React.useState("");

  React.useEffect(() => {
    if (!orderId) {
      setOrderObj(null);
      return;
    }
    let active = true;
    getOrderById(orderId).then((o) => {
      if (active) setOrderObj(o);
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const handleFind = async (orderNumber: string, contact: string) => {
    const found = await getOrderById(orderNumber);
    if (!found) {
      setFindError("We couldn't find an order with those details.");
      return;
    }
    setOrder(found.id);
    setContactEmail(contact);
    setFindError(undefined);
    router.push("/initiate-return?step=2");
  };

  const handleSelectComplete = () => {
    router.push("/initiate-return?step=3");
  };

  const handleStartOver = () => {
    useReturnsStubStore.getState().reset();
    router.push("/initiate-return?step=1");
  };

  return (
    <main className="flex-1">
      <Section padding="md">
        <Container size="narrow">
          <Display level="md" as="h1" className="mb-8">Initiate a return</Display>
          <ReturnFlowProgress current={step} />

          <div className="mt-12">
            {step === 1 && <FindOrderForm onSubmit={handleFind} error={findError} />}

            {step === 2 && order && (
              <ReturnItemsSelector
                order={order}
                selectedKeys={selectedItems}
                reason={reason}
                onToggle={toggleItem}
                onReasonChange={setReason}
                onSubmit={handleSelectComplete}
              />
            )}

            {step === 2 && !order && (
              <div className="flex flex-col gap-4">
                <p className="text-[14px] text-foreground-secondary">
                  No order selected. Start over?
                </p>
                <Button variant="outline" onClick={handleStartOver}>Start over</Button>
              </div>
            )}

            {step === 3 && order && (
              <ReturnConfirmation orderId={order.id} email={contactEmail} itemCount={selectedItems.length} />
            )}
          </div>
        </Container>
      </Section>
    </main>
  );
}

export default function InitiateReturnPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <React.Suspense fallback={null}>
        <InitiateReturnInner />
      </React.Suspense>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question about my return." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Smoke (start dev briefly, hit all 7 new routes + /initiate-return?step=2):
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 4
for r in /our-story /sustainability /product-care /shipping-returns /privacy /contact /initiate-return; do
  curl -s -o /dev/null -w "$r → HTTP %{http_code}\n" "http://localhost:3000$r"
done
pkill -f "next dev" 2>/dev/null || true
```
Expected: all 200.

- [ ] **Step 4:** Commit:
```bash
git add src/app/initiate-return/page.tsx
git commit -m "feat(returns): add /initiate-return wizard (step 1-3 via ?step= param)"
```

---

# Section E — Custom 404

### Task 20: not-found.tsx

**Files:** `src/app/not-found.tsx`.

- [ ] **Step 1:** Implement:

```tsx
import * as React from "react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="lg">
          <Container size="narrow" className="text-center">
            <p className="font-heading text-[120px] leading-none text-foreground-primary md:text-[180px]">404</p>
            <Display level="md" as="h1" className="mt-4">Page not found</Display>
            <p className="mt-4 mx-auto max-w-md text-[14px] text-foreground-secondary">
              The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <div className="mt-10">
              <Link href="/">
                <Button size="lg">Back to home</Button>
              </Link>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
```

- [ ] **Step 2:** Build verify.

- [ ] **Step 3:** Commit:
```bash
git add src/app/not-found.tsx
git commit -m "feat(static): add custom 404 page"
```

---

# Section F — Verification

### Task 21: Final gate + tag

- [ ] **Step 1:** `pnpm test` — expect 136 (131 baseline + 5 returns store).
- [ ] **Step 2:** `pnpm build` — confirm all 8 new routes appear.
- [ ] **Step 3:** `pnpm lint` — 0 errors.
- [ ] **Step 4:** Tag:
```bash
git tag phase-7-static-returns-complete
git log --oneline -1
```

---

## Self-Review

- ✅ All 6 static pages built (Our Story, Sustainability, Product Care, Shipping & Returns, Privacy, Contact)
- ✅ 3-step Initiate Return flow with URL-driven state
- ✅ Custom branded 404
- ✅ Returns store + getOrderById lookup gracefully handles bad order numbers
- ✅ All pages use the standard chrome (AnnouncementBar + SiteHeader + SiteFooter + WhatsAppWidget)

## Out-of-scope

- Real return-label generation (deferred — backend phase, Royal Mail/DHL API)
- CMS-editable static page content (deferred — admin phase)
- Animation pass

## Execution

Subagent-driven, section-batched (A worktree → B static primitives → C 6 static pages → D returns store + 3 components → E /initiate-return + 404 → F verify).
