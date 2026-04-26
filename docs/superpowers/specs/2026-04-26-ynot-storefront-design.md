# YNOT London — Storefront Frontend Design Spec

**Date:** 2026-04-26
**Scope:** Customer-facing storefront only. Admin panel is a separate sub-project (will get its own design + plan cycle later).
**Status:** Brainstorming output, awaiting user review before invoking `writing-plans`.

---

## Context

YNOT London is a premium women's outerwear brand (jackets, blazers, bombers, coats — leather/suede/wool/cotton/Tencel). Pencil.dev pixel-perfect design exists for 17 unique screens in `ynot.pen` (42 frames including mobile variants and component subframes). Brand brief in `YNOT_Design_Brief_PencilDev.md`. Admin panel requirements separate in `YNOT_Admin_Panel_Spec.md`.

Stack already scaffolded in `web/`: Next.js 16 + TypeScript + Tailwind v4 (App Router, Turbopack). Design tokens (colours, fonts, spacing, breakpoints) already mirrored from `.pen` into `web/src/app/globals.css`. Inter + Playfair Display loaded via `next/font`. Brand logos in `web/public/brand/`. 10 base components built so far (Button, Input, Container, Display, Eyebrow, Icons, AnnouncementBar, SiteHeader, SiteFooter, ProductCard) with showcase at `/ui-kit`.

This spec defines the entire storefront end-state: routes, overlays, page anatomies, component inventory, architecture decisions. The implementation plan (next step via `writing-plans`) will sequence the actual build work.

---

## Out of scope (explicitly deferred)

- **Admin panel** — own brainstorm + spec + plan cycle later
- **Backend API endpoints** — frontend talks to typed `lib/data/*` adapters (mock JSON now, real API later); endpoint contracts defined in implementation plan
- **Stripe integration** — real payment processing scheduled after frontend is functional. During build phase the PaymentForm uses **plain styled inputs** (card number / expiry / CVC) wired to a stub `submitPayment()` that returns a fake order ID. Swap to `@stripe/react-stripe-js` Elements in a dedicated Stripe-integration phase.
- **Royal Mail / DHL API integration** — UI shows shipping options; real label generation/tracking lives in admin work
- **Reviews & UGC** (admin spec module #10) — not in design, not in MVP
- **Email signup popup** — declined; brief disallows newsletter in footer; popup is also out
- **Animations / motion design** — explicit deferral. Build all components and pages first with static state changes; do a dedicated Animation Pass with its own plan after the full surface is in place
- **Multi-currency** — GBP only (admin spec module #15 marked Low priority)
- **Activity logs / data export / SEO panel CMS UI** — admin concerns
- **Wishlist** — not in brief or design

---

## 1. Routes and overlays

### Public routes
- `/` — Homepage
- `/collection/[slug]` — Category landing (slug from CMS; e.g. `jackets`, `leather`, `wool`)
- `/products/[slug]` — Product Detail Page
- `/search` — Search results (overlay → Enter sends here)
- `/our-story`, `/product-care`, `/sustainability`, `/shipping-returns`, `/privacy`, `/contact` — CMS-driven static
- `/sign-in`, `/register`, `/forgot-password`, `/reset-password` — Auth (public access)
- `/initiate-return` — Returns flow (guest-allowed)
- `/cart` — Cart full page (mobile only; desktop uses drawer)
- `/checkout/shipping`, `/checkout/payment`, `/checkout/success/[id]` — Checkout sub-routes (guest + auth)
- `*` — 404 catch-all

### Auth-gated routes
- `/account` — Dashboard (default tab: orders)
- `/account/orders` — Orders list (active tab variant)
- `/account/orders/[id]` — Order detail
- `/account/addresses` — Saved addresses (tab)
- `/account/profile` — Profile + change password (tab)
- `/account/pre-orders` — Pre-orders (separate per admin spec #19)

> Account uses **shared layout with active-tab routing**: `/account/*` all render the same `AccountLayout` (welcome heading + sticky tabs); the URL drives which tab content is shown. Gives both design fidelity (single page UX) and shareable URLs / back-button behaviour.

### Site overlays (triggered from chrome)
- **MenuSidebar** — left drawer; lists categories from CMS (Jackets / Blazers / Bombers / Coats / Leather / Suede / Wool / Cotton / Tencel)
- **CartDrawer** — right drawer (desktop); same data as `/cart` page; auto-opens on Add to Bag
- **SearchOverlay** — full-screen modal; live results inline; Enter → `/search?q=`

### Always-visible
- **AnnouncementBar** — rotating CMS messages
- **SiteHeader** — sticky; logo swaps white↔black based on `overHero` + scroll
- **SiteFooter** — 4 columns; no newsletter
- **WhatsAppWidget** — floating bottom-right on every page (including checkout — confirmed)

---

## 2. Page anatomy summary

Block-by-block breakdown for each route. Block tags: **shared** (uses chrome), **unique** (page-specific), **cms** (content from admin/API).

### Homepage (`/`)
Chrome → **Hero** (full-viewport, CMS image/video, wordmark + "New Collection" + SHOP CTA) → **BrandStatement** (cream bg, centred quote + sub-quote) → **ProductsRow "New Arrivals"** (4 cards + SEE MORE, CMS-driven) → **EditorialBlock "Timeless Collection"** (large image + sub-text, CMS) → **LookbookCarousel** (horizontal scroll, CMS lifestyle images) → Chrome.

### Collection (`/collection/[slug]`)
Chrome → **Breadcrumb** → **CategoryHeader** (title + optional CMS banner) → **FilterBar** (Category / Material / Size / Price Range) → **SortDropdown** (Newest / Price ↑ / Price ↓) → **ProductGrid** (4-col desktop / 2-col mobile) → **LOAD MORE** → Chrome.

### Product Detail (`/products/[slug]`)
Chrome → **Breadcrumb** → **ProductGallery** (horizontal scroll + thumbnails/dots, hover-zoom desktop / pinch mobile) → **ProductInfoPanel** (name + price + COLOUR + SizeSelector) → **AddToBagSection** (in-stock: "ADD TO BAG"; out-of-stock: "PRE-ORDER (3 WEEKS)") → **ProductDetailsAccordion** (Description / Materials / Care / Sizing) → **RecommendedProducts** ("We think you might like" — 4 cards, manual+algo per admin #8) → Chrome.

### Cart drawer (desktop) / Cart page (`/cart`, mobile)
Header "YOUR BAG" + close → **CartItem list** (thumb + name + colour/size + qty stepper + price + Remove) → **PromoCodeInput** (with APPLY) → **CartSummary** (Subtotal / Shipping=Free / Total) → **CHECKOUT** CTA → "Secure checkout" hint. Empty state: "Your bag is empty" + back-to-shop CTA.

### Checkout step 1 (`/checkout/shipping`)
**CheckoutProgress** (1 active · 2 · 3) → **ShippingForm** (First/Last name, Email, Phone w/ +44 prefix, Address, City, Postcode, Country select) → **ShippingMethodPicker** (radio: Royal Mail Free 2-3d / DHL Free 8-10d — both shown, user selects) → **CONTINUE TO PAYMENT** → sticky right column **OrderSummaryCard**.

### Checkout step 2 (`/checkout/payment`)
Progress (1 ✓ · 2 active · 3) → **PaymentForm** (Stripe Elements: card / expiry / CVC + name on card) → **Checkbox "Billing same as shipping"** → **PAY £NNN** → "256-bit SSL" hint → sticky **OrderSummaryCard**.

### Checkout step 3 (`/checkout/success/[id]`)
"Thank You for Your Order" + Order # + email-sent message → Progress (✓ ✓ Confirmed) → **OrderDetails** (items + total) → **ShippingDetails** (name + address + carrier + estimated delivery date) → **CONTINUE SHOPPING** CTA. Optional auth-conversion prompt for guests.

### Sign In (`/sign-in`)
**AuthFormLayout** → "SIGN IN" + welcome subtitle → **SignInForm** (email + password + Remember me checkbox + Forgot password link) → "SIGN IN" CTA → "New to YNOT? Create an account" link. **No social auth** (per user decision Δ1).

### Register (`/register`)
**AuthFormLayout** → "CREATE ACCOUNT" + subtitle → **RegisterForm** (First/Last name + Email + Password + T&C checkbox + Newsletter opt-in checkbox) → "CREATE ACCOUNT" CTA → "Already have an account? Sign in". **No social auth.**

### Forgot Password (`/forgot-password`)
Inline two-state in single route:
- State A: form (Email + SEND RESET LINK + Back to Sign In)
- State B: "Check Your Email — if account exists for [email]…" + Resend link

### Reset Password (`/reset-password?token=…`) [new — added per Δ5]
**AuthFormLayout** → "RESET PASSWORD" → New password + Confirm new password → SAVE → success state ("Password updated, sign in").

### Account Dashboard (`/account/*`)
**AccountLayout**: Welcome heading + sticky tabs (Order History / Addresses / Profile / Pre-orders / Sign Out). Tab content rendered per route segment.
- **Orders tab**: list of OrderListItem (Order # + date + OrderStatusBadge + £ + View Details link → `/account/orders/[id]`)
- **Order detail**: line items + shipping address + tracking link (Royal Mail / DHL) + status timeline + "Initiate return" CTA (if eligible)
- **Addresses tab**: AddressCard list + "Add new" button + Edit/Delete per card
- **Profile tab**: ProfileForm (name/email/change password)
- **Pre-orders tab**: same as Orders but filtered

### Static — Our Story / Product Care / Sustainability / Shipping & Returns / Privacy / Contact
All driven by CMS content (placeholder JSON during dev). Specific layouts:
- **Our Story**: PageHero + headline + narrative → **ValueCallouts** (4) → **PullQuote**
- **Product Care**: PageHero + **Tabs by material** (Leather / Shearling / Suede / Wool / Cotton) → **CareTabContent** (3 sections: Cleaning / Protection / Storage)
- **Sustainability**: PageHero + intro → **StatsBlock** (0% / 100% / LWG) → 4 approach sections
- **Shipping & Returns**: PageHero + **Tabs (Delivery / Returns)** → **ShippingTable** + return policy bullets → **START YOUR RETURN** CTA
- **Privacy / Contact**: simple Prose layout

### Initiate Return (`/initiate-return`)
**ReturnFlowProgress** (1 Find · 2 Select · 3 Confirm) →
- Step 1: **FindOrderForm** (Order # + email/postcode + FIND MY ORDER + helper link)
- Step 2: **ReturnItemsSelector** (order items + checkboxes + reason field)
- Step 3: **ReturnConfirmation** (pre-paid label + email confirmation message)

### 404 (`*`)
Chrome → "404" big number → "Page Not Found" + explanation → **BACK TO HOME** CTA → Chrome.

### Menu Open state
Backdrop overlay → MenuSidebar with category list → close X → category clicks navigate + close drawer.

---

## 3. Component inventory (~85 total)

Full list groups in `component-inventory-v1.html` (in `.superpowers/brainstorm/`). Summary:

**Already built (10):** Button, Input, Container, Display, Eyebrow, Icons, AnnouncementBar, SiteHeader, SiteFooter, ProductCard.

**To build (~75):**
1. **Primitives & form (12):** IconButton, Textarea, Select, Checkbox, RadioGroup, PasswordInput, PhoneInput (intl), CardInput (Stripe), QuantityStepper, SizeSelector, ColourSwatch, Skeleton.
2. **Layout & typography (4):** Prose, PageShell, Section, Grid (responsive).
3. **Overlays & interactions (8):** Drawer (base), MenuSidebar, CartDrawer, SearchOverlay, Modal/Dialog, Toast, WhatsAppWidget, Tabs, Accordion.
4. **Chrome wiring (4):** Header trigger handlers, CartBadgeBubble, Cookie banner, SEO meta defaults.
5. **Homepage blocks (5):** HeroSection, BrandStatement, ProductsRow, EditorialBlock, LookbookCarousel.
6. **Catalog (10):** Breadcrumb, CategoryHeader, FilterBar, SortDropdown, ProductGrid, ProductGallery, ProductInfoPanel, AddToBagSection, ProductDetailsAccordion, RecommendedProducts.
7. **Commerce (10):** CartItem, CartSummary, PromoCodeInput, EmptyCart, CheckoutProgress, ShippingForm, ShippingMethodPicker, PaymentForm, OrderSummaryCard, ConfirmationLayout.
8. **Account & auth (10):** AuthFormLayout, SignInForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, AccountLayout, OrderListItem, OrderStatusBadge, OrderDetailLayout, AddressCard, ProfileForm.
9. **Static & returns (10):** PageHero, ValueCallouts, StatsBlock, PullQuote, ShippingTable, CareTabContent, ReturnFlowProgress, FindOrderForm, ReturnItemsSelector, ReturnConfirmation.

---

## 4. Architecture decisions

### Data layer
- All page data flows through typed adapters in `web/src/lib/data/` — one file per domain (`products.ts`, `categories.ts`, `cart.ts`, `orders.ts`, `content.ts` for CMS, `search.ts` for the search overlay, `payments.ts` for the checkout stub).
- Each adapter exports async functions returning typed objects. Implementation now reads from JSON files in `web/src/lib/data/_mock/`. Later swap to fetch real API.
- The search adapter performs in-memory filtering over the same mock product JSON during build phase; real search backend (Algolia / Postgres FTS) is integration work later.
- Server Components call adapters directly (no client-side fetching for catalog/static).
- Cart and auth state are client-side, hydrated from API after auth check.

### State management
- **Server Components** (default) for catalog, PDP, static pages — data fetched server-side, no client JS for content.
- **Zustand** for cart drawer state and cart contents (also persisted to `localStorage` for guests; merged with server cart on login).
- **React Hook Form + Zod** for all forms (sign-in, register, checkout, returns, profile) — Zod schemas in `web/src/lib/schemas/`.
- **NextAuth.js v5** for sessions (email/password + Postgres adapter); set up in `auth.ts` at root.

### Animations & interactions
**Deferred to a separate phase after the entire storefront is functional.** Per user decision: build all components and pages with **no motion library** and **static state changes** first; introduce animations only when the full surface is in place.

What this means concretely during the build phase:
- Drawers (Menu, Cart, Search) appear/disappear instantly (CSS `display: none` toggle), no slide.
- Modal/Toast appear instantly.
- Accordion expands instantly (CSS only, `<details>` element or simple state toggle).
- Tab switches are instant.
- Hover states on cards/buttons remain (CSS only — these are not animations, they're UI affordances).
- AnnouncementBar text rotates with simple opacity crossfade (already done — keep as is).

After all components and pages are built and verified, a dedicated **Animation Pass** phase will:
- Add Framer Motion (or alternative if a lighter option fits).
- Wire drawer slide-in/out with gesture support, search overlay scale+fade, page transitions for checkout, scroll-triggered fade-in on homepage sections, accordion expand timing, tab indicator slide.
- Define timings (likely 300ms ease-out base, 400ms drawers, 600ms page fades) at that stage.
- The Animation Pass will have its own implementation plan.

### CMS content adapter
Until admin panel exists, all CMS-driven content (categories list, hero banner, lookbook, static page text, announcement messages, products, recommendations) lives in `web/src/lib/data/_mock/*.json`. Files have the **same shape** as future API responses. Schema written in Zod and shared between adapter and forms.

### Routing patterns
- App Router with co-located layouts.
- Group routes for auth: `(auth)` group hides chrome on /sign-in, /register etc.
- Group routes for checkout: `(checkout)` shows **minimal header** (centred logo + "Secure checkout" hint, no menu/search/account/cart icons) per industry standard. Footer remains; WhatsApp widget remains (per FM-5 — confirmed for every page).
- Group routes for account: `(account)` wraps in AccountLayout with shared tabs.
- Loading/error/not-found per major segment.

### Image strategy
- `next/image` everywhere with `sizes` attribute calibrated per breakpoint.
- Product images served from `/images/products/[slug]/[index].webp` (mock now, S3/R2 later).
- Lookbook images from `/images/lookbook/`.
- Hero from `/images/hero/` with optional video alt (CMS toggle).

### SEO
- `generateMetadata` per route reading from data adapters (product / category / static page meta).
- `sitemap.ts` listing all dynamic routes.
- `robots.ts`.
- JSON-LD product schema on PDP.

### Performance budget
- Homepage hero LCP < 2.5s.
- Catalog page interactive < 2s.
- No client JS on static pages besides chrome.
- Bundle target: < 150KB JS for first load on chrome routes.

---

## 5. Decisions resolved (callouts from brainstorm)

| # | Decision | Resolution |
|---|----------|------------|
| Δ1 | Social auth (Google/Apple) | **Removed** — email/password only |
| Δ2 | Carrier auto-detect vs select | **Both options always visible**, user selects (no geo-detection) |
| Δ3 | Account: tabs vs sub-routes | **Hybrid** — sub-routes `/account/orders` etc, all render shared AccountLayout with active tab |
| Δ4 | Newsletter checkbox in Register | **Kept** — opt-in, drives email campaigns (admin module CRM) |
| Δ5 | Reset password flow | **New route** `/reset-password?token=…` with new password + confirm → success |
| FM-1 | Cart drawer auto-open on Add to Bag | **Yes** — premium fashion standard |
| FM-2 | Checkout URL pattern | **Sub-routes** `/checkout/{shipping,payment,success}` |
| FM-3 | PDP URL pattern | **/products/[slug]** |
| FM-4 | Pre-orders subpage in account | **Yes** — separate tab |
| FM-5 | WhatsApp on every page | **Yes** including checkout |

---

## 6. Verification

How we'll know each piece works end-to-end:

- **Component-level:** every component gets a story in `/ui-kit` (the showcase route) with all variants/states. Visual regression caught by reviewing the kit page after each PR.
- **Page-level:** every route renders without errors with mock data. `pnpm build` must pass with zero TypeScript errors and no Next.js warnings.
- **Flow-level:** `pnpm test:e2e` runs Playwright scripts for: browse home → category → PDP → add to bag → cart → checkout step 1 → step 2 (mock Stripe) → step 3. Plus auth flow (register → forgot password → reset → sign in → account). Plus returns flow.
- **Performance:** Lighthouse CI runs in PR check; budgets enforced (LCP, JS bundle).
- **Accessibility:** axe-core checks in Playwright; keyboard navigation tested for drawers, modals, forms.

Each phase in the implementation plan must end with green CI before moving to the next.

---

## 7. Source artefacts (in repo)

- `ynot.pen` — Pencil source design (42 frames)
- `YNOT_Design_Brief_PencilDev.md` — brand brief
- `YNOT_Admin_Panel_Spec.md` — admin requirements (separate scope)
- `web/` — Next.js app (current state: 10 components built, /ui-kit showcase live)
- `.superpowers/brainstorm/93272-1777222924/content/flow-map-v2.html` — flow diagram (Visual Companion)
- `.superpowers/brainstorm/93272-1777222924/content/page-anatomy-v1.html` — anatomy diagram
- `.superpowers/brainstorm/93272-1777222924/content/component-inventory-v1.html` — component inventory

---

## Next step

Invoke `superpowers:writing-plans` skill to convert this spec into a phased implementation plan with TDD checkpoints, subagent dispatch points, and verification gates. After plan approval, `executing-plans` runs the actual build.
