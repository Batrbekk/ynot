# YNOT Storefront — Phase 8: SEO + Cookie banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Make the storefront discoverable + compliant. Add `sitemap.ts`, `robots.ts`, JSON-LD product schema on PDPs, OpenGraph metadata defaults, and a GDPR cookie banner. Small mechanical phase that closes the launchable storefront.

**Architecture:** Built-in Next.js conventions for sitemap/robots (file-based). JSON-LD rendered server-side as a script tag in PDP `<head>` via `<Script>` or inline. Cookie banner is a global client component mounted in root layout, persists consent via localStorage; renders nothing once dismissed. Default OG image points to a brand asset.

**Tech Stack:** Next.js 16 App Router, TS, Tailwind v4, React 19, Vitest 4.

**Source spec:** `docs/superpowers/specs/2026-04-26-ynot-storefront-design.md` § SEO + § "Cookie banner".

**Working directory:** `/Users/batyrbekkuandyk/Desktop/ynot/web/.worktrees/phase-8-seo-polish` (NEW worktree).

**Prerequisites in main:** Phases 1-7 (136 tests, all routes built).

---

## File structure

```
web/
├── public/
│   └── og/
│       └── default.jpg                   [created — 1200x630 OG image]
├── src/
│   ├── lib/
│   │   ├── seo/
│   │   │   ├── product-jsonld.ts         [created]
│   │   │   └── __tests__/
│   │   │       └── product-jsonld.test.ts [created]
│   │   └── stores/
│   │       ├── cookie-consent-store.ts    [created]
│   │       └── __tests__/
│   │           └── cookie-consent-store.test.ts [created]
│   ├── components/
│   │   └── cookie-banner.tsx              [created]
│   └── app/
│       ├── sitemap.ts                     [created]
│       ├── robots.ts                      [created]
│       ├── layout.tsx                     [modified — add OG defaults + mount CookieBanner]
│       └── products/[slug]/page.tsx       [modified — render JSON-LD]
└── (no other changes)
```

---

# Section A — Worktree

### Task 1

- [ ] **Step 1:**
```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git worktree add .worktrees/phase-8-seo-polish -b feature/phase-8-seo-polish
```

- [ ] **Step 2:**
```bash
cd .worktrees/phase-8-seo-polish
pnpm install --frozen-lockfile
pnpm build
pnpm test
```
Expected: 136 tests pass.

---

# Section B — sitemap.ts + robots.ts

### Task 2: sitemap.ts

**Files:**
- Create: `src/app/sitemap.ts`

- [ ] **Step 1:** Implement (Next.js convention — exports default async function returning route list):

```ts
import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/data/products";
import { getAllCategories } from "@/lib/data/categories";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, categories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/our-story`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/sustainability`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/product-care`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/shipping-returns`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/collection/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/products/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
```

- [ ] **Step 2:** Build verify (sitemap should appear at `/sitemap.xml`).

- [ ] **Step 3:** Commit:
```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add sitemap.ts (static + categories + products)"
```

---

### Task 3: robots.ts

**Files:**
- Create: `src/app/robots.ts`

- [ ] **Step 1:** Implement:

```ts
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account/", "/checkout/", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
```

- [ ] **Step 2:** Build verify (robots should appear at `/robots.txt`).

- [ ] **Step 3:** Commit:
```bash
git add src/app/robots.ts
git commit -m "feat(seo): add robots.ts (disallow account/checkout/api, point to sitemap)"
```

---

# Section C — Product JSON-LD

### Task 4: Product schema generator

**Files:**
- Create: `src/lib/seo/product-jsonld.ts`
- Create: `src/lib/seo/__tests__/product-jsonld.test.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "../product-jsonld";
import type { Product } from "@/lib/schemas";

const product: Product = {
  id: "p1",
  slug: "leather-biker-jacket",
  name: "Leather Biker Jacket",
  price: 89500,
  currency: "GBP",
  description: "An asymmetric leather biker jacket.",
  images: ["/cms/products/03.jpg", "/cms/lookbook/01.jpg"],
  colour: "Black",
  sizes: ["S", "M", "L"],
  categorySlugs: ["jackets", "leather"],
  stock: { S: 0, M: 3, L: 1 },
  preOrder: false,
  details: { materials: "Leather", care: "", sizing: "" },
};

describe("buildProductJsonLd", () => {
  it("returns Product schema with required fields", () => {
    const json = buildProductJsonLd(product, "https://ynotlondon.com");
    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("Product");
    expect(json.name).toBe("Leather Biker Jacket");
    expect(json.image).toEqual([
      "https://ynotlondon.com/cms/products/03.jpg",
      "https://ynotlondon.com/cms/lookbook/01.jpg",
    ]);
    expect(json.brand?.name).toBe("YNOT London");
    expect(json.offers.priceCurrency).toBe("GBP");
    expect(json.offers.price).toBe("895.00");
    expect(json.offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock when no size has stock and not pre-order", () => {
    const out = { ...product, stock: { S: 0, M: 0, L: 0 }, preOrder: false };
    const json = buildProductJsonLd(out, "https://ynotlondon.com");
    expect(json.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("marks pre-order availability", () => {
    const pre = { ...product, stock: { S: 0, M: 0, L: 0 }, preOrder: true };
    const json = buildProductJsonLd(pre, "https://ynotlondon.com");
    expect(json.offers.availability).toBe("https://schema.org/PreOrder");
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import type { Product } from "@/lib/schemas";

export interface ProductJsonLd {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string[];
  sku: string;
  brand: { "@type": "Brand"; name: string };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: string;
    price: string;
    availability: string;
  };
}

function availability(product: Product): string {
  if (product.preOrder) return "https://schema.org/PreOrder";
  const inStock = Object.values(product.stock).some((n) => (n ?? 0) > 0);
  return inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

function formatPriceMajor(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export function buildProductJsonLd(product: Product, baseUrl: string): ProductJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((src) =>
      src.startsWith("http") ? src : `${baseUrl}${src}`,
    ),
    sku: product.id,
    brand: { "@type": "Brand", name: "YNOT London" },
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/products/${product.slug}`,
      priceCurrency: product.currency,
      price: formatPriceMajor(product.price),
      availability: availability(product),
    },
  };
}
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/seo/product-jsonld.ts src/lib/seo/__tests__/product-jsonld.test.ts
git commit -m "feat(seo): add Product JSON-LD generator with stock/pre-order availability"
```

---

### Task 5: Render JSON-LD on PDP

**Files:**
- Modify: `src/app/products/[slug]/page.tsx`

- [ ] **Step 1:** Read current PDP:
```bash
cat src/app/products/[slug]/page.tsx
```

- [ ] **Step 2:** Add JSON-LD `<script>` tag inside the `<>...</>` JSX (top of returned fragment, before `<AnnouncementBar />`):

In `src/app/products/[slug]/page.tsx`, add at the imports:

```tsx
import { buildProductJsonLd } from "@/lib/seo/product-jsonld";
```

Inside the page body, after the product is loaded (right before the return), add:

```tsx
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";
const jsonLd = buildProductJsonLd(product, baseUrl);
```

Then in the JSX, immediately after `return (` and `<>`, add:

```tsx
<script
  type="application/ld+json"
  // eslint-disable-next-line react/no-danger
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

(Use the eslint-disable so the `react/no-danger` rule doesn't complain — JSON-LD is a known-safe content type written by us.)

- [ ] **Step 3:** Build verify.

- [ ] **Step 4:** Commit:
```bash
git add src/app/products/[slug]/page.tsx
git commit -m "feat(seo): inject Product JSON-LD on PDP"
```

---

# Section D — OpenGraph defaults

### Task 6: Add OG metadata in root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1:** Read current layout:
```bash
cat src/app/layout.tsx
```

- [ ] **Step 2:** Replace the current `metadata` export with an enriched version:

```tsx
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YNOT London",
    template: "%s · YNOT London",
  },
  description:
    "Urban outerwear, built to endure. Designed to be relied on. Premium women's outerwear from London.",
  openGraph: {
    type: "website",
    siteName: "YNOT London",
    title: "YNOT London",
    description: "Urban outerwear, built to endure. Designed to be relied on.",
    url: SITE_URL,
    images: [
      {
        url: "/cms/hero.jpg",
        width: 1200,
        height: 630,
        alt: "YNOT London — Premium Outerwear",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YNOT London",
    description: "Urban outerwear, built to endure. Designed to be relied on.",
    images: ["/cms/hero.jpg"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};
```

(Keep the existing `Inter`/`Playfair_Display` font setup and the `RootLayout` function unchanged.)

- [ ] **Step 3:** Build verify.

- [ ] **Step 4:** Commit:
```bash
git add src/app/layout.tsx
git commit -m "feat(seo): expand root metadata (OG, twitter, metadataBase, title template)"
```

---

# Section E — Cookie banner

### Task 7: cookie consent store

**Files:**
- Create: `src/lib/stores/cookie-consent-store.ts`
- Create: `src/lib/stores/__tests__/cookie-consent-store.test.ts`

- [ ] **Step 1:** Failing test:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCookieConsentStore } from "../cookie-consent-store";

beforeEach(() => {
  useCookieConsentStore.setState({ status: "pending" });
});

describe("cookie consent store", () => {
  it("starts in pending state", () => {
    expect(useCookieConsentStore.getState().status).toBe("pending");
  });

  it("accept marks status as accepted", () => {
    useCookieConsentStore.getState().accept();
    expect(useCookieConsentStore.getState().status).toBe("accepted");
  });

  it("decline marks status as declined", () => {
    useCookieConsentStore.getState().decline();
    expect(useCookieConsentStore.getState().status).toBe("declined");
  });

  it("isResolved returns true when not pending", () => {
    expect(useCookieConsentStore.getState().isResolved()).toBe(false);
    useCookieConsentStore.getState().accept();
    expect(useCookieConsentStore.getState().isResolved()).toBe(true);
  });
});
```

- [ ] **Step 2:** Run, fail.

- [ ] **Step 3:** Implement:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Status = "pending" | "accepted" | "declined";

interface ConsentState {
  status: Status;
  accept: () => void;
  decline: () => void;
  isResolved: () => boolean;
}

export const useCookieConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      status: "pending",
      accept: () => set({ status: "accepted" }),
      decline: () => set({ status: "declined" }),
      isResolved: () => get().status !== "pending",
    }),
    { name: "ynot-cookie-consent" },
  ),
);
```

- [ ] **Step 4:** Run, pass.

- [ ] **Step 5:** Commit:
```bash
git add src/lib/stores/cookie-consent-store.ts src/lib/stores/__tests__/cookie-consent-store.test.ts
git commit -m "feat(state): add cookie consent store (pending/accepted/declined)"
```

---

### Task 8: CookieBanner

**Files:**
- Create: `src/components/cookie-banner.tsx`
- Modify: `src/app/layout.tsx` (mount CookieBanner)

- [ ] **Step 1:** Implement `src/components/cookie-banner.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCookieConsentStore } from "@/lib/stores/cookie-consent-store";

export function CookieBanner() {
  const status = useCookieConsentStore((s) => s.status);
  const accept = useCookieConsentStore((s) => s.accept);
  const decline = useCookieConsentStore((s) => s.decline);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid SSR/CSR mismatch — render only after mount once persist hydrates
  if (!mounted) return null;
  if (status !== "pending") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border-light bg-surface-primary shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-10">
        <p className="text-[13px] leading-relaxed text-foreground-primary md:max-w-[640px]">
          We use cookies to give you the best shopping experience and analyse site traffic.
          See our{" "}
          <Link href="/privacy" className="underline hover:no-underline">
            privacy policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex flex-shrink-0 gap-3">
          <Button variant="outline" size="md" onClick={decline}>
            Decline
          </Button>
          <Button size="md" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Mount in `src/app/layout.tsx` — add import and render inside `<body>` after `{children}` and `<SiteOverlays>`:

In imports section, add:

```tsx
import { CookieBanner } from "@/components/cookie-banner";
```

In the body JSX, add after `<SiteOverlays>`:

```tsx
<CookieBanner />
```

- [ ] **Step 3:** Build verify.

- [ ] **Step 4:** Commit:
```bash
git add src/components/cookie-banner.tsx src/app/layout.tsx
git commit -m "feat(seo): add CookieBanner mounted globally with consent persistence"
```

---

# Section F — Verification

### Task 9: Final gate + tag

- [ ] **Step 1:** `pnpm test` — expect 143 (136 baseline + 3 product-jsonld + 4 cookie-consent).
- [ ] **Step 2:** `pnpm build` — confirm sitemap + robots routes registered (Next will list them in build output).
- [ ] **Step 3:** Smoke:
```bash
pnpm dev > /tmp/ynot-dev.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "/sitemap.xml → HTTP %{http_code}\n" http://localhost:3000/sitemap.xml
curl -s -o /dev/null -w "/robots.txt → HTTP %{http_code}\n" http://localhost:3000/robots.txt
curl -s http://localhost:3000/products/leather-biker-jacket | grep -c 'application/ld+json' || true
pkill -f "next dev" 2>/dev/null || true
```
Expected: 200 + 200 + 1 (JSON-LD script tag found).

- [ ] **Step 4:** `pnpm lint` — 0 errors.

- [ ] **Step 5:** Tag:
```bash
git tag phase-8-seo-polish-complete
git log --oneline -1
```

---

## Self-Review

- ✅ sitemap.ts dynamically lists static + category + product URLs
- ✅ robots.ts blocks /account /checkout /api, points to sitemap
- ✅ JSON-LD Product on PDP with correct availability based on stock + pre-order
- ✅ Root metadata enriched (OG, Twitter, metadataBase, title template)
- ✅ Cookie banner persists consent, hides when resolved, has clear Accept/Decline + privacy link
- ✅ All existing tests still pass

## Out-of-scope

- Real analytics integration (GA4/Meta Pixel — admin spec; gated by cookie consent)
- Sitemap submission to Google Search Console (deploy-time)
- favicon variations (apple-touch-icon, android-chrome) — left to a polish pass
- Animation pass (Phase 9)

## Execution

Subagent-driven, section-batched (A worktree → B sitemap+robots → C JSON-LD → D OG meta → E cookie banner → F verify).
