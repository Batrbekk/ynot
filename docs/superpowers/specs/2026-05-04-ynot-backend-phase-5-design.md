# YNOT London — Backend Phase 5 — Orders, Fulfilment, Email, Refunds, Cron, Pre-orders, Mini Admin

**Date:** 2026-05-04
**Status:** Draft (awaiting user review)
**Scope:** Phase 5 of 6 in the YNOT backend roadmap. Wires live carrier integrations (DHL Express MyDHL API + Landed Cost API; Royal Mail Click & Drop API) for label generation and tracking; ships React-Email branded transactional templates via Resend; introduces a mini operational admin surface (`/admin/orders`, `/admin/orders/[id]`, `/admin/orders/[id]/ship`, `/admin/returns`, `/admin/returns/[id]`, `/admin` dashboard); implements customer-initiated returns with carrier-aware policy (UK = free prepaid label, International = customer pays + customs paperwork) gated by Жансая's inspection approval; adds Stripe-driven refunds (full + per-item partial); implements pre-order flow with mixed cart and 1-Order-N-Shipments architecture; introduces a separate `ynot-worker` Docker container running scheduled jobs via `node-cron` for `PENDING_PAYMENT` recovery, cart cleanup, tracking sync (60-min interval), and abandoned-cart recovery emails (1h + 24h cadence); adds local-filesystem label PDF storage behind a swappable `LabelStorage` interface.

---

## 1. Context

Phase 4 (Cart, Checkout, Stripe) shipped a server-of-record cart, real Stripe `PaymentIntent` checkout, guest checkout via ghost users, and an idempotent webhook that flips orders from `PENDING_PAYMENT` → `NEW`. It deliberately stopped short of physical fulfilment: shipping rates come from a static `MockDhlProvider`; UK is hard-coded to `£0`; transactional email is the Console fallback that prints to `stderr`; no labels are generated; no tracking is captured; refunds are not handled.

Phase 5 closes that gap end-to-end: every paid order produces a real carrier shipment with a tracking number, customer receives a branded receipt + ship-confirmation email, status flows through `NEW → PROCESSING → SHIPPED → DELIVERED` automatically, customer can request a return through a self-service flow, Жансая approves it through a minimal admin surface, and Stripe refunds fire on her approval click.

Phase 5 also tackles the two background-job needs that Phase 4 deferred:

1. **`PENDING_PAYMENT` recovery** — orders stuck in `PENDING_PAYMENT` (browser closed, payment abandoned mid-flow) lock stock indefinitely. A cron must release them after a TTL.
2. **Abandoned-cart recovery emails** — Phase 4 captures `CartEvent.kind = ABANDONED` semantically but ships nothing user-facing. Phase 5 actually sends two emails (1h and 24h after the last `ITEM_ADDED` with no `CHECKED_OUT`).

Pre-orders, deferred from Phase 4 entirely, also land here. The schema fields (`Product.preOrder`, `OrderItem.isPreorder`, `OrderItem.preorderBatchId`, `PreorderBatch` model) all exist; Phase 5 wires the actual flow with the architectural choice of **one Order, multiple Shipments**.

External-dependency status at the start of Phase 5:

| Dependency | Status | Note |
|---|---|---|
| Stripe Test mode | ✅ wired (Phase 4) | Live keys swap via env at production deploy |
| Resend domain `ynotlondon.com` | ✅ verified (DKIM/SPF) | API key in `.env.local` |
| DHL Express MyDHL API + Landed Cost API | ✅ approved 2026-05-01 | Credentials in `.env.local` as `DHL_API_KEY` / `DHL_API_SECRET` |
| Royal Mail Click & Drop API | ✅ approved 2026-05-04 | OLP pay-as-you-go account; `ROYAL_MAIL_API_KEY` in `.env.local`; no Customer Account Number needed for OLP |
| GoDaddy DNS for `ynotlondon.com` | ✅ active | Production deploy will repoint A-record to VPS once chosen |

Subsequent phases (out of scope here):

- **Phase 6 — Admin Panel (full):** RBAC roles UI, products CRUD with image upload, content CMS (heroes, lookbook, static pages), promo-code admin, marketing tools (newsletter export, segments), audit-log viewer, replaces the Phase 5 mini admin pages with a polished surface.
- **Phase 7 — Production launch:** infrastructure (VPS provisioning, Caddy reverse proxy, GitHub Actions deploy pipeline, Postgres backups, Cloudflare in front, log aggregation), monitoring (Sentry, uptime), VAT registration if turnover threshold crossed.

---

## 2. Goals

1. Ship **live carrier integrations** for both Royal Mail (UK) and DHL Express (International). After `payment_intent.succeeded`, the worker creates a real shipment via the carrier API, captures the tracking number on `Order.trackingNumber`, persists the label PDF locally, and transitions the Order to `SHIPPED`.
2. Replace `MockDhlProvider` (Phase 4 placeholder) with **`DhlExpressProvider`** for International rate quotes at the shipping step. Call **DHL Landed Cost API** in parallel to surface the duty estimate to the customer **before payment** (DDP transparency).
3. Replace `ConsoleEmailService` ↔ `ResendEmailService` factory selection at runtime (already in place) with **12 branded React-Email templates** (10 customer-facing + 2 admin alerts) that route through Resend in production, plus rebrand the Phase 3 verify/reset templates to share the same `<EmailLayout>` (14 templates total).
4. Stand up a **mini operational admin surface** at `/admin/*` gated by `UserRole.ADMIN | OWNER` (already in schema). Six pages cover daily ops: dashboard, orders list, order detail with action buttons, ship/print, returns list, return detail.
5. Implement **customer-initiated returns** wired into the existing `/initiate-return` storefront wizard (frontend already in place from earlier work). Backend creates a `Return` row, generates a prepaid Royal Mail return label PDF (UK only) via Click & Drop API, sends a customer-facing return-instructions email (DHL email includes a CN22/CN23 customs declaration template).
6. **Inspection-gated refunds.** When the returned package arrives, Жансая reviews items in `/admin/returns/[id]`, clicks Approve or Reject. Approval triggers an instant Stripe refund (full or partial via per-item amount), restocks inventory, and sends a refund-issued email. Rejection sends a refund-rejected email with the inspection notes.
7. **Pre-order flow with mixed cart.** A cart that mixes in-stock and pre-order items checks out as **one Order** with multiple `Shipments`: Shipment #1 covers in-stock items (despatched within 1–2 working days), Shipment #2+ cover pre-order items (despatched when the matching `PreorderBatch.status = SHIPPING`). New `OrderStatus` values `PARTIALLY_SHIPPED` and `PARTIALLY_DELIVERED` capture the in-between state.
8. **Separate `ynot-worker` container.** A second Docker compose service runs `node-cron` and hosts every scheduled job: PENDING_PAYMENT recovery (every 5 min), cart cleanup (hourly), tracking sync (every 60 min), abandoned-cart recovery email scheduler (every 5 min, processes due jobs from a queue table).
9. **Recovery emails.** Two cadences for abandoned carts: 1h after the last `ITEM_ADDED` with no `CHECKED_OUT`, and 24h after with a 10% promo code (auto-generated, single-use, 7-day expiry).
10. **Carrier failure resilience.** Three fault tolerance points: (1) shipping quote — fall back to `mock-dhl.ts` regional rate + DDU disclosure if DHL API is down; (2) label creation — silent retry with exponential backoff (1m, 5m, 15m, 1h, 6h), then email Жансая with a deep-link to `/admin/orders/[id]/ship` on persistent failure; (3) tracking sync — silent skip with alert after 5 consecutive failures.
11. **Local-filesystem label PDF storage** behind a `LabelStorage` interface. Default `LocalFsStorage` writes to `/var/lib/ynot/labels/{shipmentId}.pdf` (mounted Docker volume `/data/labels`); `S3Storage` and `R2Storage` adaptors are stubbed for a one-env-var swap when GoDaddy Object Storage or Cloudflare R2 lands.
12. **Real-Postgres tests** covering: full Order lifecycle (NEW → SHIPPED → DELIVERED), refund flow (full + partial), preorder mixed cart (1 Order, N Shipments), recovery cron (PENDING_PAYMENT timeout → cancel + restock), tracking sync (DHL + RM), email rendering (snapshot tests on rendered HTML for each template), carrier failure paths (DHL API stub returning 503 → fallback path).
13. **Storefront integrations remain minimal:** the `/initiate-return` wizard's last step posts to a new `POST /api/returns` endpoint instead of the current stub; the `/account/orders/[id]` page renders tracking link + status timeline pulled from the real Order; the cart already supports preorder items in the schema — Phase 5 surfaces them with a "Ships in 4-6 weeks" eyebrow on PDP and cart row.

---

## 3. Non-goals

- ❌ **Production deploy / VPS provisioning.** Phase 7 owns the actual VPS choice (Hetzner CX22 vs DO Droplet vs other), Caddy config, GitHub Actions deploy pipeline, Postgres backup strategy, Cloudflare in front, log aggregation. Phase 5 documents that hosting will be self-hosted Docker compose; the `ynot-worker` service is added to the existing `docker-compose.yml` so local dev mirrors production topology.
- ❌ **Webhook-based DHL tracking (push).** Phase 5 polls every 60 min via `TrackingProvider.getStatus()`. DHL Push API is available but adds webhook signature/replay-attack/idempotency surface that isn't justified by current order volume. Revisit if DHL API quota costs become painful.
- ❌ **VAT registration / VAT line-item on receipts.** YNOT is below the £90k turnover threshold at launch. Receipts show prices VAT-inclusive without a separate VAT line. When registration happens, add `Order.vatLineCents` field and surface it in the receipt template — out of Phase 5 scope.
- ❌ **Customer self-service cancellation.** Customer cannot cancel via `/account/orders/[id]`. They email `hello@ynotlondon.com` with the order number; Жансая processes through `/admin/orders/[id]` "Cancel order" button. Decision: avoids race between customer cancel-click and Жансая already having printed a label.
- ❌ **Store-credit refunds.** All refunds go to the original payment method (Stripe `refunds.create({ payment_intent })`). A `Wallet` / `Credit` model is not in Phase 5 scope.
- ❌ **Return-shipping for non-UK customers.** International (DHL) returns are customer-arranged: the return-instructions email contains the return address (`13 Elvaston Place, Flat 1, London SW7 5QG`) and a pre-filled CN22/CN23 customs declaration template, but YNOT does not generate or pay for the return waybill.
- ❌ **Restocking fees.** Refunds are full-amount on inspection-approve; no percentage held back. Luxury industry standard.
- ❌ **Stripe `charge.dispute.*` handling.** Disputes are surfaced in the Stripe dashboard; Phase 5 logs them via the webhook handler but takes no automated action. Phase 6 admin can add a "Disputes" tab.
- ❌ **Order amendment.** Customer cannot edit shipping address after order placement. They cancel + reorder if needed (admin-mediated cancel only — see above).
- ❌ **Multi-warehouse / multi-origin shipments.** All shipments originate from `13 Elvaston Place, Flat 1, London SW7 5QG`. Pre-order shipments also originate from there once the production batch arrives at the warehouse.
- ❌ **Internationalisation of email templates.** All email content is English-only. Phase 5 templates use one locale.
- ❌ **Apple/Google Pay-specific receipt branding.** Receipts treat all payment methods the same — no "Apple Pay receipt" variant.
- ❌ **Social / WhatsApp customer notifications.** Email only.
- ❌ **DHL Express UK signature service / Saturday delivery / liability insurance.** Standard DDP service for International; standard Tracked 48 for UK Royal Mail. Premium service options out of Phase 5 scope.
- ❌ **Newsletter delivery / subscriber sync to Resend Audiences.** `NewsletterSubscriber` table exists but Phase 5 doesn't touch it. Phase 6 hooks Resend Audiences sync.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Carrier API (UK) | **Royal Mail Click & Drop API** (REST + Bearer token) | OLP pay-as-you-go account approved 2026-05-04; auth via single `ROYAL_MAIL_API_KEY` Bearer header; supports `POST /orders` (create shipment), label PDF download, `GET /orders/{id}` (tracking). |
| Carrier API (International) | **DHL Express MyDHL API + Landed Cost API** (REST + API key + secret HMAC) | Approved 2026-05-01; MyDHL API for rates + AWB + label; Landed Cost API for accurate per-product duty estimate; both auth via `DHL_API_KEY` / `DHL_API_SECRET` headers. |
| DHL Push tracking | **Not used in Phase 5** | Pull-only via Tracking API every 60 min; webhook push deferred to a future phase if quota becomes painful. |
| Email rendering | **React Email** (`@react-email/components` + `@react-email/render`) | Resend-maintained; JSX templates compile to email-safe HTML with inline styles; `pnpm email dev` preview server with live-reload; type-safe template props matched to domain models. |
| Email delivery | **Resend** (`resend` SDK) — already wired Phase 3 | Transactional; verified domain `ynotlondon.com` with DKIM/SPF; free tier covers ~3000 emails/month. |
| Cron scheduler | **`node-cron`** in a separate `ynot-worker` Docker container | Standard library, ~30kb, expression-based (`*/5 * * * *`); separate container isolates job failures from web request handling. |
| Job queue (recovery emails) | **Postgres table `EmailJob`** polled every 5 min by worker | Simpler than BullMQ for current scale; rows have `dispatchAt: DateTime`, `attempts`, `lastError`; add Redis-backed BullMQ in a future phase if visibility/retry sophistication becomes needed. |
| Label PDF storage | **Local filesystem** behind `LabelStorage` interface | Default `LocalFsStorage` writes to `/var/lib/ynot/labels/`; `LABEL_STORAGE=local` env switch; `S3Storage` and `R2Storage` adaptors stubbed for a one-line swap when GoDaddy Object Storage or Cloudflare R2 lands. |
| Customs paperwork | **`pdf-lib`** (lightweight PDF generator) | Generates CN22/CN23 PDFs server-side with Order data filled in; attached to International return-instructions email; no heavy dependency on `puppeteer`. |
| Admin auth | **Existing Auth.js + `UserRole.ADMIN | OWNER` guard** in middleware | No new auth code; one new middleware matcher for `/admin/*`; all admin routes are server-rendered. |
| Admin UI | **Existing Next.js + Tailwind v4 + brand tokens** | Mini admin matches storefront chrome; reuses `<Button>`, `<Container>`, etc. Production-grade visuals are Phase 6's job. |
| Refund API | **Stripe `refunds.create`** | Full and partial supported; metadata links refund to `Return.id`; webhook `charge.refunded` updates `Payment.refundedAmountCents` and `OrderStatus`. |
| Validation | **Zod 4** | Same pattern as prior phases; one shared schema file per subsystem (`lib/schemas/return.ts`, `lib/schemas/admin-order.ts`, etc.). |
| Environment | New required vars at production: `ROYAL_MAIL_API_KEY`, `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER`, `RESEND_API_KEY`, `RESEND_FROM`, `LABEL_STORAGE` (default `local`), `LABEL_STORAGE_PATH` (default `/var/lib/ynot/labels`), `WORKER_ENABLED` (default `true`), `ALERT_EMAIL` (Жансая's inbox for failure alerts). | Env validator (Phase 1 `src/server/env.ts`) extended; missing prod-required vars cause start-up failure with clear message. |

---

## 5. Architecture

### 5.1 Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    Docker Compose                            │
├──────────────────────────────────────────────────────────────┤
│  ynot-app           (Next.js — web + API + admin)            │
│  ynot-worker        (node-cron — scheduled jobs)             │
│  ynot-postgres      (Postgres 16)                            │
│  ynot-redis         (Redis 7 — session, cache)               │
│  ynot-caddy         (reverse proxy + Let's Encrypt; prod)    │
└──────────────────────────────────────────────────────────────┘
        ↑                          ↑                  ↑
   Customer browser        Жансая browser       Stripe webhook
   (storefront, account,   (/admin/*)           DHL/RM API calls
    /initiate-return)
```

`ynot-app` owns: web pages, API routes (including `/api/admin/*` actions and `/api/webhooks/stripe`), label-creation when triggered synchronously by webhook (the Stripe webhook hand-off; details below).

`ynot-worker` owns: PENDING_PAYMENT recovery cron, cart cleanup cron, tracking sync cron, EmailJob processor (sends abandoned-cart recovery emails when due), label-creation retry queue when ynot-app's first attempt fails (the worker re-attempts via the same `CarrierService` as ynot-app uses synchronously — no code duplication).

### 5.2 Code layout

```
src/
├── lib/
│   ├── schemas/
│   │   ├── return.ts                        ← NEW: Zod for return-create + admin approve/reject
│   │   ├── admin-order.ts                   ← NEW: Zod for admin order actions
│   │   └── admin-shipment.ts                ← NEW: Zod for manual tracking override
│   └── pdf/
│       └── customs.ts                       ← NEW: pdf-lib helper to render CN22/CN23
├── emails/                                  ← NEW: React-Email templates (server-only)
│   ├── _layout.tsx                          ← Shared <EmailLayout> chrome
│   ├── order-receipt.tsx
│   ├── order-shipped.tsx                    ← One per Shipment (in-stock + per preorder)
│   ├── order-delivered.tsx
│   ├── return-instructions-uk.tsx           ← Includes prepaid label info
│   ├── return-instructions-international.tsx ← Includes CN22/CN23 attachment
│   ├── refund-issued.tsx
│   ├── refund-rejected.tsx
│   ├── abandoned-cart-1h.tsx
│   ├── abandoned-cart-24h.tsx               ← Includes auto-generated 10% promo
│   ├── verify-email.tsx                     ← REBRANDED from Phase 3 raw HTML
│   ├── password-reset.tsx                   ← REBRANDED from Phase 3 raw HTML
│   └── admin-alert-label-failure.tsx        ← Alert to Жансая
│   └── admin-alert-tracking-stale.tsx       ← Alert to Жансая
└── server/
    ├── env.ts                               ← UPDATED: adds ROYAL_MAIL_*, LABEL_STORAGE_*, ALERT_EMAIL, WORKER_ENABLED
    ├── shipping/
    │   ├── provider.ts                      ← UPDATED: ShippingRateProvider interface gains landedCost(...) method
    │   ├── dhl-express.ts                   ← NEW: live MyDHL API + Landed Cost integration
    │   ├── royal-mail.ts                    ← UPDATED: RoyalMailFreeProvider stays for rate quote (FREE), augmented with createShipment() impl
    │   ├── royal-mail-click-drop.ts         ← NEW: Click & Drop API client (createShipment, getLabel, getTracking, createReturnLabel)
    │   ├── mock-dhl.ts                      ← KEPT as fallback (renamed RegionalRateFallback for clarity)
    │   └── __tests__/
    │       ├── dhl-express.test.ts
    │       ├── royal-mail-click-drop.test.ts
    │       └── fallback.test.ts
    ├── fulfilment/                          ← NEW SUBSYSTEM
    │   ├── carrier.ts                       ← Unified CarrierService — picks provider based on Order.carrier
    │   ├── service.ts                       ← createShipmentForOrder, generateLabel, recordTracking
    │   ├── label-storage.ts                 ← LabelStorage interface
    │   ├── local-fs-storage.ts              ← LocalFsStorage default impl
    │   ├── s3-storage.ts                    ← Stubbed for future
    │   └── __tests__/
    │       ├── service.test.ts
    │       └── local-fs-storage.test.ts
    ├── tracking/                            ← NEW SUBSYSTEM
    │   ├── provider.ts                      ← TrackingProvider interface
    │   ├── dhl.ts                           ← DHL Tracking API client
    │   ├── royal-mail.ts                    ← Click & Drop tracking endpoint
    │   ├── service.ts                       ← syncOrderTracking — picks provider, normalises status
    │   └── __tests__/
    │       └── service.test.ts
    ├── returns/                             ← NEW SUBSYSTEM
    │   ├── service.ts                       ← createReturn, approveReturn, rejectReturn, refundForReturn
    │   ├── policy.ts                        ← isWithinReturnWindow, returnLabelPolicy (UK vs International)
    │   ├── customs.ts                       ← buildCustomsDeclaration (uses lib/pdf/customs.ts)
    │   └── __tests__/
    │       ├── service.test.ts
    │       └── policy.test.ts
    ├── refunds/                             ← NEW SUBSYSTEM
    │   ├── service.ts                       ← refundFull, refundPartialItems, recordRefundEvent
    │   └── __tests__/
    │       └── service.test.ts
    ├── email/
    │   ├── render.ts                        ← NEW: thin wrapper around @react-email/render
    │   ├── send.ts                          ← NEW: high-level "send <TemplateName> to <email> with <props>" helper
    │   ├── jobs.ts                          ← NEW: enqueueEmailJob, processDueEmailJobs
    │   ├── resend.ts                        ← UPDATED: now consumes pre-rendered HTML from React-Email instead of raw HTML strings
    │   ├── console.ts                       ← UPDATED: same change for consistency
    │   ├── types.ts                         ← UPDATED: EmailService interface now takes { subject, html, text, attachments? }
    │   └── __tests__/
    │       ├── render.test.ts               ← Snapshot tests on each template's HTML output
    │       ├── send.test.ts
    │       └── jobs.test.ts
    ├── orders/                              ← NEW SUBSYSTEM (separate from checkout)
    │   ├── service.ts                       ← updateStatus, listForAdmin, getForAdmin, cancelOrder
    │   ├── state-machine.ts                 ← ALLOWED_TRANSITIONS map; assertTransition()
    │   ├── shipments.ts                     ← splitOrderIntoShipments (in-stock + preorder batches)
    │   └── __tests__/
    │       ├── state-machine.test.ts
    │       ├── shipments.test.ts
    │       └── service.test.ts
    ├── preorders/                           ← NEW SUBSYSTEM
    │   ├── service.ts                       ← assignToBatch, releaseBatchForShipping
    │   └── __tests__/
    │       └── service.test.ts
    ├── checkout/
    │   ├── webhook.ts                       ← UPDATED: on payment_intent.succeeded, enqueue label creation; on charge.refunded, update Payment + OrderStatus
    │   ├── service.ts                       ← UPDATED: splits cart into Shipments at order creation; persists shipment rows
    │   └── __tests__/                       ← test additions
    └── alerts/                              ← NEW SUBSYSTEM
        ├── service.ts                       ← sendLabelFailureAlert, sendTrackingStaleAlert
        └── __tests__/
            └── service.test.ts
src/
├── worker/                                  ← NEW: separate entrypoint for ynot-worker container
│   ├── index.ts                             ← bootstraps node-cron with all schedules
│   ├── jobs/
│   │   ├── recover-pending-payment.ts       ← every 5 min
│   │   ├── cleanup-expired-carts.ts         ← every 60 min
│   │   ├── sync-tracking.ts                 ← every 60 min
│   │   ├── process-email-jobs.ts            ← every 5 min
│   │   └── retry-failed-shipments.ts        ← every 5 min
│   └── __tests__/
│       └── jobs.test.ts                     ← integration tests with mocked carriers
├── app/
│   ├── admin/                               ← NEW: mini admin surface
│   │   ├── layout.tsx                       ← Sidebar nav, admin chrome
│   │   ├── page.tsx                         ← Dashboard
│   │   ├── orders/
│   │   │   ├── page.tsx                     ← List with filters
│   │   │   └── [id]/
│   │   │       ├── page.tsx                 ← Detail + action buttons
│   │   │       └── ship/
│   │   │           └── page.tsx             ← Print labels, mark shipped
│   │   └── returns/
│   │       ├── page.tsx                     ← List
│   │       └── [id]/
│   │           └── page.tsx                 ← Detail + Approve/Reject
│   ├── api/
│   │   ├── admin/
│   │   │   ├── orders/
│   │   │   │   └── [id]/
│   │   │   │       ├── retry-label/route.ts
│   │   │   │       ├── manual-label/route.ts
│   │   │   │       ├── update-tracking/route.ts
│   │   │   │       ├── partial-refund/route.ts
│   │   │   │       ├── cancel/route.ts
│   │   │   │       └── resend-tracking-email/route.ts
│   │   │   ├── returns/
│   │   │   │   └── [id]/
│   │   │   │       ├── approve/route.ts
│   │   │   │       └── reject/route.ts
│   │   │   └── shipments/
│   │   │       └── [id]/
│   │   │           └── label.pdf/route.ts   ← Streams the local PDF (auth-gated)
│   │   ├── returns/
│   │   │   └── route.ts                     ← Customer-facing POST: create return
│   │   └── webhooks/
│   │       └── stripe/route.ts              ← UPDATED: handles charge.refunded
│   └── account/
│       └── orders/
│           └── [id]/page.tsx                ← UPDATED: shows real tracking + status timeline
└── middleware.ts                            ← UPDATED: adds /admin/* matcher with ADMIN/OWNER role guard
```

### 5.3 Subsystem responsibilities

**`fulfilment/`** is the one place that knows "given an Order with a Shipment row, talk to the right carrier API and produce a tracking number + a stored label PDF". It owns no scheduling logic itself — it's called synchronously by the Stripe webhook handler (first attempt) and by the worker's `retry-failed-shipments` job (subsequent attempts). It depends on `shipping/` providers (which hold the per-carrier HTTP clients) and on `LabelStorage` (which hides where the PDF actually goes).

**`tracking/`** is the read-side counterpart: given a tracking number + carrier, it asks the carrier API for the latest status and returns a normalised `TrackingStatus` enum (`IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | EXCEPTION`). The worker's `sync-tracking` job uses it; nothing else.

**`returns/`** owns the return-request lifecycle: creation by the customer (validates within window, creates `Return` + `ReturnItem[]` rows, generates UK return label or DHL customs declaration, sends instructions email), inspection (admin approve/reject), and the post-approval handoff to `refunds/`.

**`refunds/`** is the only place that calls `Stripe.refunds.create`. It supports full refund (sums all `OrderItem.unitPriceCents * quantity` of returned items + any returned shipping) and partial-amount refund (when admin overrides the auto-calculated amount). It writes a `RefundEvent` row for auditability and updates `Payment.refundedAmountCents` and `OrderStatus`.

**`orders/`** is the order state-machine + admin query layer. The state machine enforces allowed transitions (e.g., you cannot go from `DELIVERED` back to `SHIPPED`). The admin query layer provides paginated, filterable listings for `/admin/orders`.

**`preorders/`** wraps `PreorderBatch`-related operations: assigning a paid `OrderItem` to a batch at order creation; transitioning a batch from `IN_PRODUCTION` → `SHIPPING` and triggering label creation for every Order that has items in the batch.

**`alerts/`** sends operational alerts to `ALERT_EMAIL` (Жансая's mailbox). Two alert types: label-creation persistent failure, tracking sync prolonged outage.

**`worker/`** is the entrypoint for the `ynot-worker` Docker container. Bootstraps `node-cron` schedules and dispatches to the appropriate subsystem. No business logic lives here — it's a thin scheduler.

---

## 6. Domain models

### 6.1 New tables

```prisma
model Shipment {
  id                String          @id @default(cuid())
  orderId           String
  order             Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  carrier           Carrier
  trackingNumber    String?
  labelStorageKey   String?         // path/key for LabelStorage; null until label created
  labelGeneratedAt  DateTime?
  shippedAt         DateTime?       // set when Жансая clicks "Mark as despatched" in admin
  deliveredAt       DateTime?       // set by tracking-sync cron when carrier reports delivered
  cancelledAt       DateTime?       // set when Order is cancelled before this Shipment despatched
  attemptCount      Int             @default(0)  // retry counter for failed label creation
  lastAttemptError  String?
  // Items in this shipment (foreign key from OrderItem.shipmentId)
  items             OrderItem[]
  events            ShipmentEvent[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([orderId])
  @@index([trackingNumber])
}

model ShipmentEvent {
  id          String    @id @default(cuid())
  shipmentId  String
  shipment    Shipment  @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  status      String    // raw carrier status e.g. "in_transit", "delivered"
  description String?
  occurredAt  DateTime
  recordedAt  DateTime  @default(now())

  @@index([shipmentId, occurredAt])
}

model Return {
  id              String         @id @default(cuid())
  returnNumber    String         @unique     // RT-YYYY-NNNNN
  orderId         String
  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status          ReturnStatus   @default(REQUESTED)
  reason          String         // Free-text customer reason
  reasonCategory  ReturnReason   // Enum (e.g., DOES_NOT_FIT, NOT_AS_DESCRIBED, CHANGED_MIND, DEFECTIVE)
  inspectionNotes String?
  rejectionReason String?
  returnLabelKey  String?        // LabelStorage key for UK prepaid return label; null for International
  customsPdfKey   String?        // For International — path to generated CN22/CN23 PDF
  refundAmountCents Int?         // Final refund amount; null until approved
  approvedAt      DateTime?
  approvedBy      String?        // User.id of admin
  rejectedAt      DateTime?
  refundedAt      DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  items           ReturnItem[]
  refundEvents    RefundEvent[]

  @@index([orderId])
  @@index([status, createdAt])
}

model ReturnItem {
  id            String      @id @default(cuid())
  returnId      String
  return        Return      @relation(fields: [returnId], references: [id], onDelete: Cascade)
  orderItemId   String
  orderItem     OrderItem   @relation(fields: [orderItemId], references: [id])
  quantity      Int

  @@index([returnId])
  @@index([orderItemId])
}

model RefundEvent {
  id                String     @id @default(cuid())
  returnId          String?
  return            Return?    @relation(fields: [returnId], references: [id], onDelete: SetNull)
  orderId           String
  order             Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  stripeRefundId   String     @unique
  amountCents       Int
  reason            String     // "return_approved" | "admin_cancel" | "manual"
  createdAt         DateTime   @default(now())

  @@index([orderId])
}

model EmailJob {
  id           String          @id @default(cuid())
  template     String          // Template name e.g. "AbandonedCart1h"
  recipientEmail String
  payload      Json            // Props for the template
  dispatchAt   DateTime
  status       EmailJobStatus  @default(PENDING)
  attempts     Int             @default(0)
  lastError    String?
  sentAt       DateTime?
  cancelledAt  DateTime?       // For abandoned-cart jobs cancelled after CHECKED_OUT event
  cancelReason String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([dispatchAt, status])
  @@index([template, status])
}

enum ReturnStatus {
  REQUESTED       // Customer just submitted the return form
  AWAITING_PARCEL // Return label issued (UK) or instructions sent (International); waiting for parcel to arrive
  RECEIVED        // Жансая marked parcel as received in admin
  APPROVED        // Inspection passed, refund issued
  REJECTED        // Inspection failed, customer notified
  CANCELLED       // Customer or admin cancelled before completion
}

enum ReturnReason {
  DOES_NOT_FIT
  NOT_AS_DESCRIBED
  CHANGED_MIND
  DEFECTIVE
  ARRIVED_DAMAGED
  WRONG_ITEM
  OTHER
}

enum EmailJobStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}
```

### 6.2 Modifications to existing tables

```prisma
// OrderStatus enum gains two new values for partial-fulfilment flow.
enum OrderStatus {
  PENDING_PAYMENT
  PAYMENT_FAILED
  NEW
  PROCESSING
  PARTIALLY_SHIPPED         // NEW
  SHIPPED
  PARTIALLY_DELIVERED       // NEW
  DELIVERED
  RETURNED
  CANCELLED
}

// OrderItem gains shipmentId so each item knows which shipment carries it.
model OrderItem {
  // ...existing fields...
  shipmentId      String?
  shipment        Shipment?      @relation(fields: [shipmentId], references: [id], onDelete: SetNull)

  returnItems     ReturnItem[]   // back-reference

  @@index([shipmentId])
}

// Order gains relations to new tables; the existing trackingNumber field
// becomes derived (latest non-null Shipment.trackingNumber) and is set by
// the orders service on shipment events. Keep the column for query convenience.
model Order {
  // ...existing fields...
  shipments       Shipment[]
  returns         Return[]
  refundEvents    RefundEvent[]

  // Existing trackingNumber and estimatedDeliveryDate stay; populated from
  // the first shipment for backwards compatibility with /account/orders queries.
}
```

### 6.3 Migration sequence

1. **Migration 1: enums** — extend `OrderStatus`, add `ReturnStatus`, `ReturnReason`, `EmailJobStatus`.
2. **Migration 2: Shipment + ShipmentEvent** — new tables.
3. **Migration 3: Return + ReturnItem + RefundEvent** — new tables.
4. **Migration 4: EmailJob** — new table.
5. **Migration 5: OrderItem.shipmentId** — additive nullable column.
6. **Backfill script (one-off)**: for every existing `Order` with `status IN (NEW, PROCESSING, SHIPPED, DELIVERED)`, create one `Shipment` row capturing the existing `trackingNumber` + `carrier`; set every `OrderItem.shipmentId` to that single shipment. Idempotent — safe to re-run. Runs via `pnpm tsx scripts/backfill-shipments.ts` after deploy.

---

## 7. Order lifecycle (state machine)

### 7.1 Allowed transitions

```
PENDING_PAYMENT ─────► NEW                  (Stripe payment_intent.succeeded)
PENDING_PAYMENT ─────► PAYMENT_FAILED       (Stripe payment_intent.payment_failed)
PENDING_PAYMENT ─────► CANCELLED            (recovery cron timeout >1h)
NEW             ─────► PROCESSING           (label generated for at least one Shipment)
PROCESSING      ─────► SHIPPED              (all Shipments have shippedAt set; admin "Mark as despatched")
PROCESSING      ─────► PARTIALLY_SHIPPED    (some Shipments shippedAt set, others still null — typical mixed cart)
PARTIALLY_SHIPPED ───► SHIPPED              (last remaining Shipment shippedAt set)
SHIPPED         ─────► DELIVERED            (all Shipments deliveredAt set; tracking sync detected)
SHIPPED         ─────► PARTIALLY_DELIVERED  (some Shipments deliveredAt set, others not)
PARTIALLY_DELIVERED ─► DELIVERED            (last remaining Shipment deliveredAt set)
NEW | PROCESSING | PARTIALLY_SHIPPED | SHIPPED | PARTIALLY_DELIVERED | DELIVERED ─► RETURNED  (post-refund)
NEW | PROCESSING ────► CANCELLED            (admin cancel; restock + refund)
```

The transition map lives in `src/server/orders/state-machine.ts` as a `Record<OrderStatus, OrderStatus[]>`. `assertTransition(from, to)` throws `IllegalTransitionError` on disallowed pairs. Every status change writes an `OrderStatusEvent` row (existing model from Phase 1).

### 7.2 Order creation flow (Phase 4 + Phase 5 changes)

Phase 4 already handles order creation with stock locking and `PENDING_PAYMENT → NEW` transition. Phase 5 layers two changes on top:

1. **At order creation** (`createOrderAndPaymentIntent` in `checkout/service.ts`): the cart is also split into Shipment groups by `splitOrderIntoShipments(items)`:
   - One Shipment for all in-stock items (carrier = country-zone-resolved: GB → ROYAL_MAIL, else DHL)
   - One Shipment per distinct `PreorderBatch` referenced in the cart (same carrier resolution per batch)
   - Each `OrderItem` row gets its `shipmentId` set
2. **At `payment_intent.succeeded`** (webhook handler): for every Shipment of the Order whose `carrier` and inventory are immediately ship-ready (i.e., not awaiting a preorder batch), enqueue label creation. Preorder Shipments wait for `releaseBatchForShipping` to be called (admin action or `PreorderBatch.status = SHIPPING` trigger).

### 7.3 Shipment creation (label generation) — happens at payment time

1. Webhook receives `payment_intent.succeeded`, looks up Order, iterates Shipments where `carrier` is ready and `labelGeneratedAt IS NULL`.
2. For each, calls `CarrierService.createShipment(shipment)`:
   - Picks `RoyalMailClickDropProvider` or `DhlExpressProvider` based on `Shipment.carrier`.
   - Provider's `createShipment(shipment, order, items)` calls the carrier API, gets back `{ trackingNumber, labelPdfBytes, customsInvoicePdfBytes? }`.
   - `LabelStorage.put(shipmentId, labelPdfBytes)` writes PDF to disk; for International, also stores customs invoice.
   - Updates `Shipment` row: `trackingNumber`, `labelStorageKey`, `labelGeneratedAt = now()`.
   - Inserts `ShipmentEvent { status: 'label_created' }`.
   - If `Order.status = NEW`, transitions to `PROCESSING` (label printed, awaiting physical despatch).
3. **No email is sent** at label-generation time. Label-generated only means the carrier has the booking — the parcel is still on Жансая's desk awaiting print + handover to courier.
4. **On API failure** (5xx, network, or 4xx without retry path): increments `Shipment.attemptCount`, stores `lastAttemptError`, schedules retry via the worker's `retry-failed-shipments` cron with backoff offset. After 5 attempts → `sendLabelFailureAlert(shipment)` to Жансая.

### 7.3.1 Shipment despatch (Жансая marks "Mark as despatched")

1. Жансая prints the label PDF (from `/admin/orders/[id]/ship`), packs the parcel, hands to courier.
2. Clicks **Mark as despatched** in admin.
3. Server: sets `Shipment.shippedAt = now()`. If all Shipments of the Order have `shippedAt IS NOT NULL`, transitions `Order.status` to `SHIPPED`. If some Shipments still have `shippedAt IS NULL` (e.g., preorder Shipment waiting for batch), transitions to `PARTIALLY_SHIPPED`.
4. Sends `OrderShipped` email **once per Shipment** (idempotent — uses `Shipment.shippedAt IS NOT NULL` as the trigger guard; second click is a no-op).

### 7.4 Tracking sync flow

Worker `sync-tracking` job runs every 60 min:
1. Selects all Shipments with `trackingNumber IS NOT NULL` AND `deliveredAt IS NULL` (we stop polling once delivered).
2. For each, calls `TrackingService.sync(shipment)`:
   - Picks `DhlTrackingProvider` or `RoyalMailTrackingProvider` based on carrier.
   - Calls carrier API for current tracking events.
   - Inserts new `ShipmentEvent` rows (deduped by `(shipmentId, occurredAt, status)`).
   - If latest event is `delivered`: sets `Shipment.deliveredAt`, transitions Order to `DELIVERED` (or `PARTIALLY_DELIVERED` if other Shipments still in transit), sends `OrderDelivered` email per Shipment.
3. **On API failure**: increments per-job failure counter (Redis key `tracking_sync_failures`); after 5 consecutive cycles fail → `sendTrackingStaleAlert()` to Жансая. Counter resets on successful cycle.

### 7.5 Cancellation flow (admin-only)

Customer emails support → Жансая opens `/admin/orders/[id]` → clicks "Cancel order" (visible only when `status IN [NEW, PROCESSING, PARTIALLY_SHIPPED]` and at least one Shipment has `labelGeneratedAt IS NULL` OR no Shipments have `shippedAt IS NOT NULL`):
1. Confirms in modal with reason text.
2. Server: transitions `Order.status` to `CANCELLED`; for every Shipment without `shippedAt`, sets `Shipment.cancelledAt = now()` (preserves audit trail; queries filter on `cancelledAt IS NULL`); for every OrderItem, restocks (`ProductSize.stock += quantity`); calls `RefundService.refundFull(order, reason: 'admin_cancel')`; sends `OrderCancelled` email (added to template list).

> Edge case: if some labels are already generated but parcels not yet collected, Жансая must physically destroy/cancel those labels in MyDHL+ / Click & Drop UI. Spec captures this as an operational note in the admin UI ("Note: any printed labels must be voided manually in carrier dashboard").

---

## 8. Returns flow

### 8.1 Customer-facing flow

The existing `/initiate-return` storefront wizard (built in earlier work, frontend-only) gets a real backend in Phase 5:

1. **Step 1** — order lookup. Customer enters order number + email; backend verifies `Order.shipFirstName/shipLastName` against email (or signed-in user matches). Returns the list of returnable items (those `delivered >14 days ago` excluded).
2. **Step 2** — item selection + reason. Customer ticks items + selects `ReturnReason` enum + optional free-text.
3. **Step 3** — confirmation. Customer reviews summary + agrees to return policy.
4. **Submit** → `POST /api/returns` with `{ orderId, items: [{orderItemId, quantity}], reasonCategory, reason }`.

Server validates: each item exists on the Order, quantity ≤ ordered, return window not expired, no existing pending Return for the same items. Creates `Return` + `ReturnItem[]` rows with `status = REQUESTED`. Generates `returnNumber` via `RT-YYYY-NNNNN` sequence (mirrors `OrderNumber` pattern from Phase 4).

Then branches on `Order.shipCountry`:

- **GB (UK)**: calls `RoyalMailClickDropProvider.createReturnLabel(order)` → gets label PDF; stores at `LabelStorage.put('return-' + returnId, pdfBytes)`; updates `Return.returnLabelKey`. Sends `ReturnInstructionsUk` email with instructions + label PDF attachment + drop-off guidance ("Drop at any post office or postbox; you have 14 days to ship").
- **non-GB (International)**: calls `buildCustomsDeclaration(order)` → generates CN22/CN23 PDF using `pdf-lib`; stores at `LabelStorage.put('customs-' + returnId, pdfBytes)`; updates `Return.customsPdfKey`. Sends `ReturnInstructionsInternational` email with: return address, customs PDF attachment, original commercial invoice attachment (regenerated from Order data), instructions ("Ship via your local courier, declare as 'returned merchandise', mark with order number `YN-2026-NNNNN` on the package").

`Return.status` transitions `REQUESTED → AWAITING_PARCEL`.

### 8.2 Admin inspection flow

When the parcel arrives at the warehouse, Жансая:
1. Opens `/admin/returns/[id]` (filtered list at `/admin/returns?status=AWAITING_PARCEL` shows pending parcels).
2. Inspects the items physically.
3. Marks "Parcel received" (transitions `AWAITING_PARCEL → RECEIVED`).
4. For each item, ticks "Acceptable" or "Rejected" with notes ("worn", "tags missing", "perfume smell", etc.). Free-text inspection notes captured on `Return.inspectionNotes`.
5. Clicks **Approve** → calls `RefundService.refundForReturn(return, amount = sum of accepted items)`. Or clicks **Reject** with `rejectionReason` (returns rejected, no refund; customer notified).

### 8.3 Refund mechanics

`RefundService.refundForReturn(return)`:
1. Computes refund amount = `sum(returnItem.quantity * orderItem.unitPriceCents for accepted items)`.
2. For UK orders: + `0` (UK shipping was free, no refund line).
3. For International orders: + `0` (customer paid shipping outbound; partial returns don't refund proportional shipping per industry standard).
4. Calls `Stripe.refunds.create({ payment_intent: order.payment.stripePaymentIntentId, amount: refundAmountCents, metadata: { returnId, returnNumber } })`.
5. Inserts `RefundEvent { stripeRefundId, amountCents, reason: 'return_approved' }`.
6. Updates `Payment.refundedAmountCents += amount`. If now equals `Payment.amountCents`, sets `Payment.status = REFUNDED` and `Order.status = RETURNED`.
7. Restocks items: `ProductSize.stock += quantity` for each accepted item.
8. Updates `Return.status = APPROVED`, `refundAmountCents`, `approvedAt`, `approvedBy`, `refundedAt`.
9. Sends `RefundIssued` email with breakdown.

Stripe `charge.refunded` webhook (already received automatically) — handler just **logs and reconciles** that `Payment.refundedAmountCents` matches; no double-update.

### 8.4 Rejection flow

`RefundService` not called. Instead:
- `Return.status = REJECTED`, `rejectedAt`, `rejectionReason`, `inspectionNotes`.
- Send `RefundRejected` email with reason + inspection notes + offer to reach out via `hello@ynotlondon.com`.
- Items physically held at warehouse. Жансая decides off-app to ship them back (customer pays return shipping again) or dispose (in customer-supplied address case). Phase 5 doesn't automate this — out of scope.

### 8.5 Return policy enforcement

`returns/policy.ts`:
```ts
export function isWithinReturnWindow(order: Order, now: Date = new Date()): boolean {
  // Window starts on Shipment.deliveredAt (latest among order's shipments), 14 days.
  const latestDelivery = order.shipments.reduce(
    (acc, s) => (s.deliveredAt && s.deliveredAt > acc ? s.deliveredAt : acc),
    new Date(0),
  );
  if (latestDelivery.getTime() === 0) return false; // Not yet delivered
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  return now.getTime() - latestDelivery.getTime() <= windowMs;
}

export function returnLabelPolicy(order: Order): 'PREPAID_UK' | 'CUSTOMER_ARRANGED' {
  return order.shipCountry === 'GB' ? 'PREPAID_UK' : 'CUSTOMER_ARRANGED';
}
```

Window check happens at:
1. `/initiate-return` step 1 (frontend filters returnable items).
2. `POST /api/returns` server-side (defence in depth).

---

## 9. Pre-orders

### 9.1 Cart behavior

Already in schema: `Product.preOrder Boolean`, `OrderItem.isPreorder`, `OrderItem.preorderBatchId`, `PreorderBatch` model. Phase 5 wires it:

- PDP shows "Ships in 4-6 weeks — you'll be notified when ready" eyebrow if `Product.preOrder = true`.
- Cart drawer + `/cart` page render preorder items with the same eyebrow + don't show "Out of stock" warning even if `ProductSize.stock = 0`.
- `addItem` to cart: if `product.preOrder`, fetches the next active `PreorderBatch` (by earliest `estimatedShipFrom` with `status IN [PENDING, IN_PRODUCTION]`) and stores `cartItem.isPreorder = true` (existing field). At order creation, the `OrderItem.preorderBatchId` is set to that batch.

### 9.2 Shipment splitting at order creation

`splitOrderIntoShipments(items: OrderItem[])` returns `Shipment[]`:

1. **In-stock group**: every `OrderItem` where `isPreorder = false` → one Shipment (carrier = zone-resolved from `Order.shipCountry`).
2. **Preorder groups**: group items by `preorderBatchId` → one Shipment per batch (same carrier resolution).

This runs inside the same Prisma transaction as `Order` creation. Each Shipment row is inserted; each `OrderItem.shipmentId` gets the right one.

### 9.3 Preorder shipment release

When a `PreorderBatch` is ready to ship (Жансая decides — e.g., Spring 2027 collection arrived at warehouse):

1. Жансая opens admin (Phase 5 mini admin doesn't have a `/admin/preorders` page — defer to Phase 6); for Phase 5, she runs `pnpm tsx scripts/release-preorder-batch.ts <batchId>` from the host shell.
2. Script: sets `PreorderBatch.status = SHIPPING`. Looks up every `OrderItem` with `preorderBatchId = batchId`, groups by Order, and for each Order's preorder Shipment(s) with `labelGeneratedAt IS NULL`, calls `CarrierService.createShipment(shipment)`. Same path as Stripe webhook handles for in-stock items.
3. Each customer with a preorder item in the batch receives an `OrderShipped` email (per Shipment).

> **Phase 5 limitation:** `/admin/preorders` UI not built — Жансая uses CLI script. Phase 6 will add the admin page.

### 9.4 Preorder cancellation by customer

Customer wants to cancel preorder portion of a mixed order:
1. Customer emails support.
2. Жансая opens `/admin/orders/[id]` → clicks "Partial refund" → ticks the preorder items → `RefundService.refundPartialItems(...)` issues partial refund, restocks (no-op for preorder), removes the items' `preorderBatchId` link.
3. If preorder Shipment now has zero items, marks Shipment cancelled; if all items in Order are refunded, transitions Order to `CANCELLED` or `RETURNED` per existing logic.

---

## 10. Email templates

Phase 5 ships **12 new templates** (10 customer-facing + 2 admin alerts) + rebrands **2 existing** (Phase 3 verify + reset) for **14 total**. All use the shared `<EmailLayout>` with YNOT brand chrome (Inter body, Playfair Display headings, brand colours). All templates are React components in `src/emails/`; preview server runs at `pnpm email dev → localhost:3001`.

**Delivery model:**
- **Synchronous transactional** (sent inline within the request handler that triggers them): `OrderReceipt`, `OrderShipped`, `OrderDelivered`, `OrderCancelled`, `ReturnInstructionsUk`, `ReturnInstructionsInternational`, `RefundIssued`, `RefundRejected`, `EmailVerify`, `PasswordReset`, `AdminAlertLabelFailure`, `AdminAlertTrackingStale`.
- **Scheduled via `EmailJob` queue** (enqueued, dispatched by worker `process-email-jobs` cron): `AbandonedCart1h`, `AbandonedCart24h`. Only future-dated dispatches use the queue; everything else fires inline. If Resend is down at synchronous send time, the email is logged as failed and Жансая is alerted (Phase 6 may add a generic retry queue for transactional sends).

| Template | Trigger | Recipient | Notes |
|---|---|---|---|
| `OrderReceipt` | Stripe `payment_intent.succeeded` (synchronous after Order finalise) | Customer | Lists items, prices, shipping address, payment summary. Mixed-cart receipt has two sections: "Shipping now" + "Pre-order — ships in 4-6 weeks". |
| `OrderShipped` | Per Shipment, on `Shipment.shippedAt` set | Customer | One email per Shipment. Includes carrier, tracking number, tracking URL (`https://www.royalmail.com/track/{n}` or DHL equivalent), estimated delivery. |
| `OrderDelivered` | Per Shipment, on `Shipment.deliveredAt` set | Customer | One per Shipment; nudges to leave a review. |
| `OrderCancelled` | On admin "Cancel order" action (`/admin/orders/[id]`) | Customer | Refund amount + ETA, reason (truncated for customer-friendliness), apology copy + invitation to email `hello@ynotlondon.com` if questions. |
| `ReturnInstructionsUk` | On `POST /api/returns` for `shipCountry = GB` | Customer | Prepaid Royal Mail label as PDF attachment; instructions; 14-day ship-by date. |
| `ReturnInstructionsInternational` | On `POST /api/returns` for `shipCountry != GB` | Customer | Customs PDF + commercial invoice as attachments; return address; instructions. |
| `RefundIssued` | On `RefundService.refundForReturn` success | Customer | Amount refunded, items list, expected card-statement timing. |
| `RefundRejected` | On admin reject | Customer | Rejection reason, inspection notes, contact email. |
| `AbandonedCart1h` | EmailJob processor, 1h after last `ITEM_ADDED` with no `CHECKED_OUT` | Customer | Cart preview with "Complete your order" CTA. No discount. |
| `AbandonedCart24h` | EmailJob processor, 24h after last `ITEM_ADDED` with no `CHECKED_OUT` | Customer | Cart preview + auto-generated 10% promo code (single-use, 7-day expiry). |
| `EmailVerify` (rebranded) | Phase 3 verify-email flow | Customer | Same logic, new chrome via `<EmailLayout>`. |
| `PasswordReset` (rebranded) | Phase 3 password-reset flow | Customer | Same logic, new chrome via `<EmailLayout>`. |
| `AdminAlertLabelFailure` | After 5 retries of label creation fail | Жансая (`ALERT_EMAIL`) | Order #, error summary, deep-link to `/admin/orders/[id]/ship`. |
| `AdminAlertTrackingStale` | After 5 consecutive tracking sync cycles fail | Жансая | Affected order count, deep-link to `/admin/orders?filter=needs-tracking-update`. |

**Snapshot tests** (`src/server/email/__tests__/render.test.ts`): each template gets one snapshot test that renders with realistic props and asserts the output HTML matches a stored snapshot. Catches accidental visual regressions.

**Plain-text fallback**: every template has a `text` export that returns a plain-text version (renders the same data without HTML). Resend always sends both for deliverability.

---

## 11. Cron jobs (in `ynot-worker`)

| Job | Schedule | What it does | Failure handling |
|---|---|---|---|
| `recover-pending-payment` | `*/5 * * * *` (every 5 min) | Finds Orders with `status = PENDING_PAYMENT` and `createdAt < now() - 1h`. For each: transitions `→ CANCELLED`, restocks all OrderItems, deletes the orphaned PaymentIntent (Stripe). | Logs per-Order failure; continues processing rest. |
| `cleanup-expired-carts` | `0 * * * *` (hourly) | Deletes `Cart` rows where `expiresAt < now()`. Cascade deletes `CartItem` and `CartEvent` via Prisma. | Logs and continues. |
| `sync-tracking` | `0 * * * *` (hourly, on the hour) | For every Shipment with `trackingNumber IS NOT NULL` AND `deliveredAt IS NULL`, calls `TrackingService.sync(shipment)`. Updates `ShipmentEvent`, transitions Order/Shipment status when delivered. | Counter in Redis; alert after 5 cycles fail consecutively. |
| `process-email-jobs` | `*/5 * * * *` (every 5 min) | `SELECT * FROM EmailJob WHERE status = 'PENDING' AND dispatchAt <= now() LIMIT 50` — for each, call `EmailService.send()`; on success, mark `SENT`; on failure, increment `attempts`; if `attempts >= 3`, mark `FAILED`. | Per-job retry; permanent fails logged. |
| `retry-failed-shipments` | `*/5 * * * *` (every 5 min) | For Shipments with `labelGeneratedAt IS NULL` AND `attemptCount BETWEEN 1 AND 5` AND `updatedAt < now() - backoff(attemptCount)`, retry `CarrierService.createShipment`. Backoff = `[1m, 5m, 15m, 1h, 6h]` indexed by attemptCount. After attempt 5 fails, send `AdminAlertLabelFailure`. | Permanent fail at 5 attempts triggers alert; manual admin recovery. |
| `enqueue-abandoned-cart` | `*/5 * * * *` (every 5 min) | For every Cart with last `ITEM_ADDED` event 1h ago and no `CHECKED_OUT`, enqueue `AbandonedCart1h` EmailJob if not already enqueued (dedup on `(cartId, template)`). Same logic for 24h with `AbandonedCart24h`. Cancels jobs for carts that have since CHECKED_OUT. | Logs and continues. |

`node-cron` schedules expressed in the worker entrypoint:

```ts
// src/worker/index.ts
import cron from 'node-cron';
import { recoverPendingPayments } from './jobs/recover-pending-payment';
// ...

cron.schedule('*/5 * * * *', recoverPendingPayments);
cron.schedule('0 * * * *', cleanupExpiredCarts);
// ...
```

Worker process exits non-zero if `WORKER_ENABLED=false` (so docker-compose can keep the service definition without running it during specific local dev workflows).

---

## 12. Failure handling matrix

| Failure point | Detection | Fallback / mitigation | Alert |
|---|---|---|---|
| DHL `getRate` API down at checkout | 5xx / timeout >5s | Use `RegionalRateFallback` (the renamed `mock-dhl.ts`) with disclosure: "Estimated shipping; final rate confirmed at despatch". Switch shipping mode `DDP → DDU` with disclosure: "Final taxes due at delivery". | None — graceful degradation; logged as warning. |
| DHL `landedCost` API down at checkout | 5xx / timeout >5s | Hide duty estimate; show "Final taxes due at delivery" with country-specific copy. | Logged as warning. |
| Royal Mail Click & Drop API down at checkout | UK shipping is FREE static; not affected. | n/a | n/a |
| Carrier `createShipment` API down at webhook time | API error | Mark Shipment with `attemptCount`, schedule retry via worker (1m, 5m, 15m, 1h, 6h backoff). | After 5 fails: `AdminAlertLabelFailure` to Жансая. |
| Stripe `refunds.create` fails | API error | Transaction rolls back: no `RefundEvent` row, `Return.status` stays in `RECEIVED`. Жансая sees error toast in admin, can retry via "Approve" button again. | Logged; persistent failures (3+ retries by Жансая) raise her own follow-up via email/Slack. |
| Resend email send fails | API error / 5xx | EmailJob row has `attempts++`, retried up to 3 times by `process-email-jobs`. | After 3 fails: row marked `FAILED`; logged; surfaced in `/admin/email-jobs?status=FAILED` (added to mini admin if simple). |
| Tracking sync API persistent outage | 5+ consecutive cycle failures | Continue cycling; manual admin update available via `/admin/orders/[id]` "Update tracking status" button. | `AdminAlertTrackingStale` to Жансая. |
| Worker container crash | Docker compose restart policy `restart: unless-stopped` | Auto-restart; jobs idempotent so no double-execution risk on missed cycles. | Out of Phase 5 scope (Phase 7 monitoring). |
| Local FS for label storage runs out of disk | Write fails | Fall back to in-memory hold + alert; explicit operational task to GC old labels (>1y) | Alert on disk usage >90% — Phase 7 monitoring. |
| Customer return outside window | Server-side `isWithinReturnWindow` rejects | `400 Bad Request` with friendly message; UI displays "This order is outside the 14-day return window — please email hello@ynotlondon.com if you have a special case." | n/a — expected user error. |

---

## 13. API surface

### 13.1 Customer-facing endpoints (new in Phase 5)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/returns` | Create a Return for an Order. Body: `{ orderId, items: [{orderItemId, quantity}], reasonCategory, reason }`. Response: `{ returnId, returnNumber }`. |
| `GET` | `/api/returns/[id]` | Customer reads their own Return status (auth: signed-in user owns the Order, OR HMAC `__ynot_order_token` cookie). |

### 13.2 Admin endpoints (new in Phase 5)

All gated by `UserRole.ADMIN | OWNER` middleware on `/admin/*` and `/api/admin/*`. CSRF protected via Auth.js patterns.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin` | Dashboard — counts of pending shipments, returns awaiting inspection, alerts. |
| `GET` | `/admin/orders` | Paginated list with filters (status, carrier, country, "needs action" badge). |
| `GET` | `/admin/orders/[id]` | Order detail. |
| `GET` | `/admin/orders/[id]/ship` | Print/re-print labels page. |
| `POST` | `/api/admin/orders/[id]/retry-label` | Re-trigger Shipment label creation for the Order's pending Shipments. |
| `POST` | `/api/admin/orders/[id]/manual-label` | Form submission with `{ trackingNumber, labelPdfBytes (multipart upload) }`. Updates Shipment, marks SHIPPED. |
| `POST` | `/api/admin/orders/[id]/update-tracking` | Body: `{ shipmentId, status: 'SHIPPED' | 'DELIVERED' }`. Manual status advance. |
| `POST` | `/api/admin/orders/[id]/partial-refund` | Body: `{ items: [{orderItemId, quantity}] }`. Issues Stripe partial refund. |
| `POST` | `/api/admin/orders/[id]/cancel` | Body: `{ reason }`. Full cancel + refund + restock. |
| `POST` | `/api/admin/orders/[id]/resend-tracking-email` | Re-triggers `OrderShipped` email for the latest Shipment. |
| `GET` | `/admin/returns` | Paginated list with status filter. |
| `GET` | `/admin/returns/[id]` | Return detail. |
| `POST` | `/api/admin/returns/[id]/approve` | Body: `{ acceptedItems: [{returnItemId}], inspectionNotes }`. Issues refund + restocks. |
| `POST` | `/api/admin/returns/[id]/reject` | Body: `{ rejectionReason, inspectionNotes }`. |
| `GET` | `/api/admin/shipments/[id]/label.pdf` | Streams label PDF from `LabelStorage`; used by the `/admin/orders/[id]/ship` page's print preview. |

### 13.3 Stripe webhook updates

`POST /api/webhooks/stripe` (existing route from Phase 4) gains handlers for:
- `charge.refunded` — reconciles `Payment.refundedAmountCents` if drift, idempotent via existing `StripeEvent` dedup.

`payment_intent.succeeded` handler is extended to enqueue label creation per Shipment (immediate, synchronous attempt; on failure schedules worker retry).

---

## 14. Mini admin UI

### 14.1 Layout

`src/app/admin/layout.tsx` — sidebar nav with sections: Dashboard, Orders, Returns. Header with user display + "Sign out" + environment badge ("Production" | "Local dev").

### 14.2 Dashboard (`/admin`)

Cards showing today's metrics:
- Orders awaiting label creation (count + click → filtered Orders list)
- Returns awaiting inspection (count + click → filtered Returns list)
- Active alerts (label failures, tracking stale) — none expected daily, but visible if any

### 14.3 Orders list (`/admin/orders`)

Table columns: Order #, Customer (name + email), Total (£), Status badge, Carrier, Country, Created at, Actions (`View →`).

Filters: status (dropdown — all values), carrier (Royal Mail / DHL / All), country (free-text), "needs action" badge (orders with failed shipments OR stuck tracking). Search by order #, customer email, tracking #.

Pagination: 50 per page, server-side via Prisma `cursor`.

### 14.4 Order detail (`/admin/orders/[id]`)

Sections (top to bottom):
- **Header**: Order # + status badge + total + customer + "Open in Stripe →" deep link (uses `Payment.stripePaymentIntentId`).
- **Shipping address** (read-only).
- **Items**: table with qty, price, isPreorder badge, current Shipment, refund status.
- **Shipments**: per-Shipment card with carrier, tracking #, status, label PDF button ("View label"), shipped/delivered timestamps.
- **Status history**: timeline of `OrderStatusEvent` rows.
- **Payment**: amount, refunded amount, breakdown of `RefundEvent` rows.
- **Action buttons** (right rail or bottom): Retry label generation, Manual label override, Update tracking status, Partial refund, Cancel order, Resend tracking email. Each opens a confirmation modal.

### 14.5 Print labels page (`/admin/orders/[id]/ship`)

For each Shipment with a generated label:
- Embedded PDF preview (iframe pointing at `/api/admin/shipments/[id]/label.pdf`)
- "Print" button (uses browser print dialog targeting the iframe)
- "Mark as despatched" button — sets `Shipment.shippedAt`, transitions Order, sends `OrderShipped` email (idempotent — second click no-ops).

For Shipments without a generated label: shows "Label not yet generated" + manual-override form (file upload + tracking number input).

### 14.6 Returns list (`/admin/returns`)

Table: Return #, Order #, Customer, Items count, Reason category, Status badge, Created at, Actions.

Filters: status (all enum values), reason category. Default filter: `status IN [REQUESTED, AWAITING_PARCEL, RECEIVED]` (active returns).

### 14.7 Return detail (`/admin/returns/[id]`)

Sections:
- **Header**: Return # + status + Order # link.
- **Customer message**: reason category + free-text reason.
- **Items**: each with original price, quantity returned, "Acceptable" / "Rejected" toggle (with notes per item).
- **Inspection notes**: free-text textarea.
- **Refund preview**: live-calculated based on accepted-items selection.
- **Actions**: "Mark received" (only when status = AWAITING_PARCEL), "Approve refund", "Reject return".

---

## 15. Testing strategy

### 15.1 Test database

Continues Phase 4 pattern: `web/.env.test` points at `postgresql://...ynot_test`; Vitest runs migrations + truncates between tests. New tables (Shipment, Return, etc.) automatically covered by the same harness.

### 15.2 Carrier API mocking

Two layers:
- **`__mocks__/dhl-express.ts`** + **`__mocks__/royal-mail-click-drop.ts`** — return canned responses for `createShipment`, `getTracking`, `createReturnLabel`. Exercised by unit tests of `fulfilment/service.ts`, `tracking/service.ts`, `returns/service.ts`.
- **MSW (Mock Service Worker)** for integration tests that need HTTP-level fidelity (e.g., 503 fallback testing).

### 15.3 Email rendering

`src/server/email/__tests__/render.test.ts` — one test per template, renders with `realisticProps`, asserts against snapshot. Run on every CI; snapshot drift requires explicit re-record (`pnpm test -u`).

### 15.4 Cron job tests

`src/worker/__tests__/jobs.test.ts` — invokes each job function with seeded Postgres state, asserts side-effects (rows inserted, statuses transitioned, EmailJobs enqueued). No `node-cron` involvement — schedule wiring tested separately with a single trivial test.

### 15.5 End-to-end happy path

`src/__tests__/e2e/order-lifecycle.test.ts` — single integration test:
1. Create Cart with 1 in-stock GB item.
2. Checkout (mocked Stripe).
3. Trigger webhook `payment_intent.succeeded`.
4. Assert `OrderReceipt` email enqueued, Order status `NEW`, label creation called.
5. Assert Shipment row has tracking #, label key, status `SHIPPED`, `OrderShipped` email enqueued.
6. Trigger `sync-tracking` job with mock returning "delivered".
7. Assert Order status `DELIVERED`, `OrderDelivered` email enqueued.

Plus parallel scenarios: International order; mixed in-stock + preorder; carrier failure path.

### 15.6 Coverage target

No mandatory % gate, but each new subsystem must have `service.test.ts` covering happy path + 1 error path. Target: maintain Phase 4's pattern of ~338 tests; expect Phase 5 to add ~100-150 more.

---

## 16. Migrations checklist

In order; each landed by a separate Prisma migration commit.

1. `add_partial_order_statuses` — extends `OrderStatus` enum.
2. `create_shipment_tables` — `Shipment`, `ShipmentEvent`.
3. `create_return_tables` — `Return`, `ReturnItem`, `ReturnStatus`, `ReturnReason`.
4. `create_refund_event_table` — `RefundEvent`.
5. `create_email_job_table` — `EmailJob`, `EmailJobStatus`.
6. `add_shipment_id_to_order_item` — additive nullable column.
7. `create_return_number_seq` — Postgres sequence `return_number_seq` for `RT-YYYY-NNNNN`.
8. `backfill_shipments` — one-off SQL backfill or `pnpm tsx scripts/backfill-shipments.ts` post-deploy.

---

## 17. Configuration / environment

Additions to `src/server/env.ts` (Zod):

```ts
ROYAL_MAIL_API_KEY: z.string().min(1),
DHL_API_KEY: z.string().min(1),
DHL_API_SECRET: z.string().min(1),
DHL_ACCOUNT_NUMBER: z.string().min(1),
RESEND_API_KEY: z.string().min(1),
RESEND_FROM: z.string().min(1),
LABEL_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
LABEL_STORAGE_PATH: z.string().default('/var/lib/ynot/labels'),
WORKER_ENABLED: z.string().transform(v => v !== 'false').default('true'),
ALERT_EMAIL: z.string().email(),
```

Production-required: all of the above. Local dev: `WORKER_ENABLED` may be `false` to disable cron in the dev container; `RESEND_API_KEY` may be empty (falls back to `ConsoleEmailService`).

`.env.example` updated to document each.

---

## 18. Rollout plan

Phase 5 lands as one feature branch, one PR (squash-merged). Rollout is local-only — no production deploy in Phase 5 (Phase 7 owns prod). Sequence:

1. **PR open** — full implementation, ~85 commits, all tests passing.
2. **Manual QA pass** in local dev:
   - Create test Order with Stripe test cards, verify Shipment row + label PDF generated locally.
   - Trigger `sync-tracking` job manually with mocked carrier responses.
   - Initiate return for the test Order, verify email + label PDF.
   - Approve return in `/admin/returns/[id]`, verify Stripe refund + email.
   - Test mixed-cart preorder flow with one preorder Product seeded.
   - Test failure paths: DHL API down (mock 503) → fallback rate; webhook delivers but label generation fails → retry queue → alert email.
3. **Code review** — focus on state machine correctness, idempotency of webhook + worker jobs, refund math.
4. **Merge** — squash to `main` with full commit message summarising scope.
5. **`docs/manual-qa.md` updated** — Phase 5 section with checklist of every flow to verify in production smoke test.

---

## 19. Risks & open questions

### 19.1 Risks

- **DHL API quota**: Free tier may exhaust on tracking polls (50 orders × 24 hourly polls = 1200 calls/day, > 1000/day free limit). Mitigation: monitor first month; upgrade to paid tier (~$X/mo) before free runs out.
- **Royal Mail Click & Drop OLP rate limits**: Not documented publicly; assume generous for our volume (<100 calls/day). Will discover during integration; test with throttled mock first.
- **PDF library footprint**: `pdf-lib` is ~500KB; we accept the dep weight to avoid `puppeteer` (~100MB). If customs PDF generation gets complex, may need `@pdf-lib/fontkit` add-on.
- **EmailJob table growth**: One row per outbound email; never deleted. After 1 year × 1000 emails/month = 12k rows — fine. Add archival TTL in Phase 6 if growth surprises.
- **Local FS label backup**: VPS disk failure means lost labels. Mitigation: documented daily `tar.gz` to off-VPS storage as a Phase 7 deploy task.
- **Mixed-cart shipment count**: Preorder customer may receive 3+ separate parcels (one in-stock, two preorder batches). UX risk — make sure cart + receipt + emails clearly explain. Spec already has receipt sectioning ("Shipping now" / "Pre-order").

### 19.2 Open questions deferred to Phase 6 / 7

- **Refund timing notification copy** — what does the receipt-email say about how long Stripe takes to credit the customer's card? Standard Stripe copy is "1-3 working days; up to 10 for some banks." We use that verbatim.
- **Pre-order admin UI** — Phase 5 ships CLI script for batch release. Phase 6 adds `/admin/preorders` page.
- **Label storage migration to S3/R2** — interface ready; actual swap deferred until GoDaddy storage option investigated or Cloudflare R2 setup decided.
- **Newsletter sync to Resend Audiences** — `NewsletterSubscriber` table sits untouched in Phase 5; Phase 6 wires sync.
- **VAT registration trigger** — when YNOT crosses £90k turnover, a Phase 5.x patch adds `Order.vatLineCents` and updates receipt template. Not Phase 5 scope.

---

## 20. Definition of done

Phase 5 PR merges when:

1. ✅ All migrations apply cleanly on a fresh DB.
2. ✅ `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build` all green.
3. ✅ Test count grows by 100+ over Phase 4 baseline (338 → ~440+).
4. ✅ All 14 email templates render in `pnpm email dev` preview.
5. ✅ Manual QA checklist (section 18 step 2) passes in local dev with test Stripe + mocked carriers.
6. ✅ `docker-compose.yml` includes `ynot-worker` service with `node-cron` schedules; `pnpm tsx src/worker/index.ts` boots cleanly.
7. ✅ `web/docs/manual-qa.md` Phase 5 section added.
8. ✅ Schema docs updated in `prisma/schema.prisma` comments.

Production rollout is **not** part of Phase 5 — that's Phase 7.
