# YNOT London — Manual QA Checklist

Phase-by-phase manual verification steps for what automated tests **cannot** check: real browser rendering, third-party integrations (Stripe, DHL, Royal Mail, Resend), end-to-end user flows, and subjective UX (typography, animation, hover states).

Run before each production deploy. Tick boxes inline as you go; commit ticks back to repo so the team can see the last verified state.

---

## How to use this doc

- **One terminal per service.** Many checks need the dev server, Stripe CLI, Postgres+Redis Docker, and `stripe listen` running simultaneously. Each section flags what must be running.
- **Test cards (Stripe Test mode):**
  - `4242 4242 4242 4242` — basic Visa, no 3DS, succeeds
  - `4000 0025 0000 3155` — requires 3DS challenge, succeeds
  - `4000 0000 0000 9995` — declined (insufficient funds)
  - `4000 0000 0000 0341` — succeeds first time, fails on attach (for SetupIntent edge cases)
  - For all: any future expiry, any CVC, any postcode (`SW1A 1AA` for UK)
- **Reset state between flows:** Sign out, clear `__Secure-ynot_cart` + `__ynot_order_token` + Auth.js cookies in DevTools → Application → Cookies. Or use Incognito.
- **DB resets:** `pnpm prisma migrate reset --force && pnpm prisma db seed` — wipes all data. Use only if state gets unrecoverable.

---

## Status Legend

- ✅ **Verified** — manually exercised on the latest build
- ⏸️ **Pending** — code merged, manual check not yet done
- ❌ **Broken** — known issue, see `Notes` row
- 🔒 **Blocked** — requires external dependency (e.g. live DHL API access)
- 🧊 **Future** — phase not started yet

---

# Phase 1 — Foundation (merged in `3fb93a5`)

**Status:** ✅ implicitly verified by passing all later phases. No new user-facing UI; this phase set up Postgres schema, Redis, Prisma, environment validation, the seed script, and `/api/health`.

| Check | Status |
|---|---|
| `pnpm prisma migrate status` reports all migrations applied | ⏸️ |
| `GET /api/health` returns `{ status: "ok", db: "ok", redis: "ok" }` | ⏸️ |
| `pnpm prisma db seed` runs idempotently (run twice — second time should be a no-op or upsert pass) | ⏸️ |
| `pnpm prisma studio` opens and all 30+ tables are visible | ⏸️ |
| Env validation: missing `DATABASE_URL` → server boot fails with clear error | ⏸️ |
| Env validation: malformed `DATABASE_URL` → boot fails with Postgres connect error (not silent) | ⏸️ |

**Notes:** Phase 1 is plumbing only. All later phases verify this implicitly.

---

# Phase 2 — Catalog & CMS reads (merged in `8000062`)

**Status:** ⏸️ depends on real catalog data; visible in storefront pages.

**Requirements running:** `pnpm dev` + Postgres/Redis Docker + seeded DB.

## Catalog browsing

| Check | URL / action | Expected | Status |
|---|---|---|---|
| Homepage hero loads | `/` | Hero image, title, CTA visible; no console errors | ⏸️ |
| Featured collections render | `/` | Curated product carousels show real product cards (not lorem) | ⏸️ |
| Category landing | `/coats` (or any seeded category slug) | Grid of products; pagination works if >12 items | ⏸️ |
| Product detail page | Click a product | Title, price, images, sizes, colours, description, materials, sizing all populated | ⏸️ |
| Image carousel | On PDP | Arrow keys advance; thumbnails clickable; lazy-load doesn't flash | ⏸️ |
| Size selector | On PDP | Out-of-stock sizes shown but disabled with "Out of stock" indicator | ⏸️ |
| Search overlay | Click search icon → type | Results appear within ~200ms; keyboard navigation works (↑↓ Enter Esc) | ⏸️ |
| Search empty state | Type "asdfqwerty" | "No results for …" copy renders | ⏸️ |
| Mobile catalog | Resize <768px or DevTools mobile | Filters move to drawer; grid becomes 1-2 columns; bottom nav appears | ⏸️ |

## CMS surfaces

| Check | URL | Expected | Status |
|---|---|---|---|
| About page | `/about` | Static markdown rendered with brand styling | ⏸️ |
| Returns policy | `/returns` | Renders without 500 | ⏸️ |
| Contact | `/contact` | Renders | ⏸️ |
| Shipping policy | `/shipping` | Renders | ⏸️ |
| Privacy policy | `/privacy` | Renders | ⏸️ |
| 404 | `/this-does-not-exist` | Custom 404 with brand-styled link back home | ⏸️ |

## Performance

| Check | How | Expected | Status |
|---|---|---|---|
| LCP < 2.5s on PDP | Chrome DevTools Performance | Largest Contentful Paint < 2.5s on cable connection | ⏸️ |
| No CLS jumps | Same | Cumulative Layout Shift < 0.1 | ⏸️ |
| Images optimised | Network tab | All product images served as `next/image` (avif/webp) | ⏸️ |

---

# Phase 3 — Auth & Customer (merged in `fcd6de1`)

**Status:** ⏸️ — auth flow needs real email delivery now that Resend is verified for `ynotlondon.com`.

**Requirements running:** `pnpm dev` + Docker + verified Resend domain.

## Sign up + email verification

| Check | URL / action | Expected | Status |
|---|---|---|---|
| `/register` form | Open page | Email + password + confirm fields; brand-styled | ⏸️ |
| Validation: short password | Submit `pass1` | Inline error "Password must be at least 12 characters" | ⏸️ |
| Validation: mismatched confirm | Different password fields | Inline error "Passwords don't match" | ⏸️ |
| Submit valid registration | Real test email | Redirect to `/verify-email`; **email arrives within 30s** with 6-digit code | ⏸️ |
| Email rendering in Gmail | Open the verification email | "From: YNOT London `<hello@ynotlondon.com>`"; HTML formatted; DKIM ✓ in headers | ⏸️ |
| Code entry | Type the code, submit | Redirect to `/account` (signed in); session cookie set | ⏸️ |
| Wrong code | Submit `000000` | Inline error "Invalid or expired code"; can retry | ⏸️ |
| Expired code (15min+ old) | Submit a stale code | Inline error "Expired" | ⏸️ |
| Resend code | Click "Resend" | New email arrives; rate-limited if spammed (5/hr) | ⏸️ |

## Sign in + sign out

| Check | URL / action | Expected | Status |
|---|---|---|---|
| `/sign-in` form | Open | Email + password; brand-styled | ⏸️ |
| Wrong password | Submit | Inline error "Invalid credentials" | ⏸️ |
| Unverified email | Try sign-in before verifying | Error "Please verify your email first" + Resend link | ⏸️ |
| Successful sign-in | Valid creds | Redirect to `/account` (or `next` URL); session cookie set | ⏸️ |
| Sign out | `/account` → menu → Sign out | Redirect to home; session cookie cleared | ⏸️ |
| Session persistence | Sign in → close tab → reopen | Still signed in (30-day rolling) | ⏸️ |
| Multi-device sign-in | Sign in on phone + desktop | Both sessions active | ⏸️ |

## Password reset

| Check | URL / action | Expected | Status |
|---|---|---|---|
| `/forgot-password` | Submit email | "If that account exists, we sent a code" (no email enumeration) | ⏸️ |
| Email arrives | Inbox | 6-digit reset code, brand-styled | ⏸️ |
| `/reset-password?email=...` | Open from email link | Code field + new password field | ⏸️ |
| Wrong code | Submit | "Invalid or expired code" | ⏸️ |
| Valid code + password | Submit | Redirect to `/sign-in`; sign in with new password works | ⏸️ |

## Account dashboard

| Check | URL / action | Expected | Status |
|---|---|---|---|
| `/account` (unauthenticated) | Hit URL directly | Redirect to `/sign-in?next=/account` | ⏸️ |
| `/account` (authenticated) | Sign in first | Order list (empty for new users), profile menu | ⏸️ |
| `/account/profile` — change name | Submit new name | Saved; reload shows new value | ⏸️ |
| `/account/password` — change password | Old + new | Saved; sign out + back in with new password works | ⏸️ |
| `/account/addresses` — add | Add a UK address | Appears in list; default toggle works | ⏸️ |
| `/account/addresses` — edit | Click pencil | Form pre-populated; save updates | ⏸️ |
| `/account/addresses` — delete | Click trash | Confirmation dialog; deletion sticks | ⏸️ |
| `/account/orders` — empty state | New user | "You haven't placed any orders yet" copy | ⏸️ |
| `/account` — delete account | Settings → Delete | 2-step confirmation; soft-deletes user, signs out | ⏸️ |

## Security

| Check | How | Expected | Status |
|---|---|---|---|
| CSRF on POST routes | DevTools → modify x-csrf-token | 403 Forbidden | ⏸️ |
| Rate limit on `/sign-in` | Submit 11+ wrong passwords in 1 min | 429 with retry-after header | ⏸️ |
| Rate limit on `/register` | 6+ registrations in 10 min from same IP | 429 | ⏸️ |
| Session revocation | Change password → other devices? | Other sessions still valid (Phase 6 follow-up: add `passwordChangedAt`) | ⏸️ |
| Email enumeration on `/sign-in` | Try existing vs nonexistent email with wrong password | Same error message for both | ⏸️ |

---

# Phase 4 — Cart, Checkout, Stripe (merged in `5a1f3eb`)

**Status:** ⏸️ critical — never been live-tested in browser.

**Requirements running:** `pnpm dev` + Docker + `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (copy `whsec_...` to `.env.local` if it changed).

## Cart subsystem (server-of-record)

| Check | Action | Expected | Status |
|---|---|---|---|
| Empty cart on first visit | Open `/cart` in Incognito | "Your bag is empty"; `__Secure-ynot_cart` cookie set after add | ⏸️ |
| Add to bag (PDP) | Click "Add to bag" with size + colour | Cart drawer opens; item added; toast confirms | ⏸️ |
| Cart drawer | Click bag icon | Slide-in shows items, qty steppers, remove, subtotal | ⏸️ |
| Update quantity (+/-) | Click stepper | Quantity changes; subtotal recomputes; round-trip < 200ms | ⏸️ |
| Remove item | Click X on line | Item gone; subtotal updates | ⏸️ |
| Stock conflict | Try to add 99 of size that has stock 2 | Toast "Only 2 left — quantity adjusted"; cart shows 2 | ⏸️ |
| Promo: valid | Apply `WELCOME10` | -10% line appears; total reduced | ⏸️ |
| Promo: invalid | Apply `NOPECODE` | Toast "Promo code not found" | ⏸️ |
| Promo: expired | Set up an expired promo in DB; apply | Toast "Promo expired" | ⏸️ |
| Promo: remove | Click X next to promo | Discount removed; total restored | ⏸️ |
| `/cart` page (full) | Click "View bag" | Same data as drawer; promo input visible; "Proceed to checkout" CTA | ⏸️ |
| Cart persists across reload | Add → reload | Cart still has item (server-side via cookie) | ⏸️ |
| Cart persists across tabs | Open `/cart` in two tabs → modify in one | Other tab refetches on focus and shows updated state | ⏸️ |
| Cart merge on signin | Add as guest → sign in (existing account) | Items merged into user's existing cart (dedupe by productId+size, capped at stock) | ⏸️ |
| Cart adopt on signin | Add as guest → sign in (no existing user cart) | Guest cart's items appear as user's cart | ⏸️ |
| Cart cleared post-checkout | Complete a successful payment | Cart empty after redirect to `/checkout/success` | ⏸️ |

## Checkout flow

| Check | Action | Expected | Status |
|---|---|---|---|
| `/checkout/shipping` (empty cart) | Open with empty cart | Redirect to `/` | ⏸️ |
| Country select drives quote | Type address with `GB` | Royal Mail Tracked 48 — FREE — 2-3 days appears | ⏸️ |
| Switch to `US` | Change country | DHL Express Worldwide (DDP) appears with non-zero rate; UK option disappears | ⏸️ |
| DDP duties shown | International quote | Order summary shows "International shipping & duties: £XX" line | ⏸️ |
| Switch to `FR` | Change country | DHL with 20% duty rate applied to subtotal | ⏸️ |
| Address validation | Submit incomplete | Inline errors block "Continue to payment" | ⏸️ |
| Saved address (signed-in) | Open shipping page | Dropdown "Use saved address" populates fields | ⏸️ |
| `/checkout/payment` no address | Hit URL directly | Redirect to `/checkout/shipping` | ⏸️ |
| PaymentIntent creation | Page loads | "Preparing payment…" briefly; PaymentElement iframe renders | ⏸️ |
| Stripe Elements styling | PaymentElement rendered | Matches brand (or at least doesn't look broken) | ⏸️ |
| Apple Pay button | On Safari with Wallet card | Apple Pay button appears in PaymentElement | ⏸️ |
| Google Pay button | Chrome with Google Pay | Google Pay button appears | ⏸️ |

## Card payment scenarios

| Card | Expected | Status |
|---|---|---|
| `4242 4242 4242 4242` (UK) | Pay → redirect to `/checkout/success/{id}` → polling flips status to NEW | ⏸️ |
| `4242 ...` (US shipping) | Same with DDP duties charged | ⏸️ |
| `4000 0025 0000 3155` (3DS) | 3DS modal → Complete → return to /success → status flips to NEW | ⏸️ |
| `4000 0084 0000 1629` (3DS but auth fails) | Modal → fail → return → "Payment didn't go through" → "Try again" | ⏸️ |
| `4000 0000 0000 9995` (insufficient funds) | Inline "Your card was declined" error → cart preserved → can retry | ⏸️ |
| `4000 0000 0000 0002` (generic decline) | Same as above | ⏸️ |
| `4000 0027 6000 3184` (3DS challenge then succeeds) | 3DS modal → success | ⏸️ |
| Double-click "Pay" | Tap twice fast | SDK debounces; only one PaymentIntent confirmed; one Order created | ⏸️ |

## Order finalization

| Check | Action | Expected | Status |
|---|---|---|---|
| Webhook receives event | Watch `stripe listen` terminal | `payment_intent.succeeded` event arrives within ~2s of payment | ⏸️ |
| Webhook signature verified | Forwarded request | Server returns 200 (visible in `stripe listen` output) | ⏸️ |
| Webhook idempotency | Replay event manually: `stripe events resend evt_xxx` | Server returns 200, no duplicate state changes | ⏸️ |
| Order in DB | Check via Prisma Studio | `Order.status = NEW`, `Payment.status = CAPTURED`, `OrderStatusEvent` row exists | ⏸️ |
| Stock decremented | Check `ProductSize.stock` | Reduced by ordered quantity | ⏸️ |
| Promo redemption | If `WELCOME10` was used | `PromoCode.usageCount` incremented; `PromoRedemption` row created | ⏸️ |
| Failed payment release | Use declined card | Stock restored; `Order.status = PAYMENT_FAILED`; `Payment.status = FAILED` | ⏸️ |

## Success page + claim

| Check | Action | Expected | Status |
|---|---|---|---|
| `/checkout/success/{id}` polling | Land on page right after pay | "Confirming your payment…" briefly; flips to "Payment received!" within 3s | ⏸️ |
| Order details rendered | After flip | Items, total, shipping address all correct | ⏸️ |
| Guest claim form appears | Guest order, status NEW | "Save your details" form with password input | ⏸️ |
| Claim password too short | Submit `pass1` | Inline error "12+ characters" | ⏸️ |
| Claim valid password | Submit | "Account created" success state; reload shows form gone | ⏸️ |
| Sign in with claimed account | Go to `/sign-in` | Login works; `/account/orders` shows the order | ⏸️ |
| Direct `/checkout/success/{id}` (other user) | Sign out, hit URL | 403 Forbidden (no order token cookie, not signed in as owner) | ⏸️ |
| Direct `/checkout/success/{id}` (token expired) | Wait 24h+ then revisit | 403; need email link (Phase 5) | ⏸️ |
| Refresh after claim | Reload success page | Form gone (user is now signed in); order still visible | ⏸️ |

## Attribution capture

| Check | Action | Expected | Status |
|---|---|---|---|
| UTM params captured | Visit `/?utm_source=instagram&utm_campaign=fall26` | Cookie `__ynot_attribution` set | ⏸️ |
| UTM persists through cart | Browse → add → checkout | Cookie still present at `/checkout/payment` | ⏸️ |
| UTM persisted on Order | Complete order | `Order.utmSource = 'instagram'` in DB | ⏸️ |
| Last-touch wins | Visit with `?utm_source=google` after instagram | Cookie overwritten; new value persisted | ⏸️ |
| Organic visit doesn't clear | No UTM param visit | Existing cookie unchanged | ⏸️ |

## Edge cases

| Check | Action | Expected | Status |
|---|---|---|---|
| Sign-in mid-checkout (existing user, no cart) | Add as guest → click Sign in → return | Cart adopted; back at /checkout/shipping with same items | ⏸️ |
| Sign-in mid-checkout (existing user, has cart) | Add as guest → sign in (user already had cart) | Cart merged; user's promo (if any) preserved | ⏸️ |
| Stale cookie (cart deleted from DB) | Tamper cookie or delete cart row | New cart created, cookie rotated | ⏸️ |
| Email already has full account | Try guest checkout with that email | 409 "This email has a YNOT account — sign in to place your order." | ⏸️ |
| Two guest orders, same email | Order twice as guest with same email | Both orders tied to one ghost user | ⏸️ |
| Two-tab race | Add same item to last-stock from two tabs | One succeeds, one gets stock-conflict toast | ⏸️ |

---

# Phase 5 — Orders & Fulfilment (🧊 not started)

**Will need verified once shipped:**

## DHL Express integration (live API)

🔒 Blocked on DHL Express MyDHL API access approval (request submitted; existing Tracking + Location Finder APIs already provisioned at developer.dhl.com under app `230200799`).

| Check | Expected | Status |
|---|---|---|
| Live rate quote at checkout for US/EU | Replaces MockDhlProvider; rate matches Landed Cost API result | 🧊 |
| AWB created on `payment_intent.succeeded` | DHL API call returns valid air waybill number | 🧊 |
| Label PDF generated | Visible in admin (Phase 6) or sent via email | 🧊 |
| Tracking events polled or pushed | `Order.trackingNumber` populated; statuses surface in `/account/orders/[id]` | 🧊 |
| Customs invoice attached | DHL ships with proper paperwork | 🧊 |

## Royal Mail Click & Drop integration

🔒 Blocked on Royal Mail Click & Drop API key (still needs setup; details in `~/.claude/projects/.../memory/project_royal_mail.md`).

| Check | Expected | Status |
|---|---|---|
| AWB / tracking ref created on UK order success | Click & Drop API returns label PDF + tracking number | 🧊 |
| Tracking visible in `/account/orders/[id]` | Status updates as parcel moves | 🧊 |

## Resend transactional email templates

| Check | Action | Expected | Status |
|---|---|---|---|
| Order receipt email | After successful payment | Branded HTML with line items, shipping address, total, tracking placeholder | 🧊 |
| Shipped email | When AWB created (Phase 5 cron or webhook) | "Your order has shipped" with tracking link | 🧊 |
| Out for delivery email | DHL/RM tracking webhook | Sent | 🧊 |
| Delivered email | Same | Sent | 🧊 |
| Payment failed recovery | After `payment_intent.payment_failed` | "Complete your order" email with retry link (24h TTL) | 🧊 |
| Email rendering across clients | Litmus or manual: Gmail web/iOS/Android, Outlook, Apple Mail | No layout breaks; logo + buttons render | 🧊 |
| Reply-To routing | Customer replies | Lands in `zhansaya@ynotlondon.com` M365 inbox | 🧊 |

## Refunds

| Check | Action | Expected | Status |
|---|---|---|---|
| Manual refund via Stripe Dashboard | Refund order from Stripe → `charge.refunded` webhook | `Payment.refundedAmountCents` set; `Order.status = REFUNDED` | 🧊 |
| Customer email | After refund | "Refund processed" branded email | 🧊 |

## Recovery cron

| Check | Action | Expected | Status |
|---|---|---|---|
| Stuck `PENDING_PAYMENT` order > 1h | Cron sweep | Order cancelled, stock released | 🧊 |
| Expired guest cart cleanup | Cron sweep `Cart.expiresAt < now()` | Deleted | 🧊 |

---

# Phase 6 — Admin Panel & Ops (🧊 not started)

**Will need verified once shipped:**

## RBAC

| Check | Action | Expected | Status |
|---|---|---|---|
| Non-admin hits `/admin` | Sign in as customer → URL | 403 / redirect | 🧊 |
| Admin sign-in | Sign in as `User.role = ADMIN` | `/admin` accessible | 🧊 |
| Audit log writes | Admin edits a product/order | `AuditLog` row created with before/after | 🧊 |

## Order management

| Check | Action | Expected | Status |
|---|---|---|---|
| Order list with filters | Status, date range, customer search | Filters work; pagination correct | 🧊 |
| Manual refund | Admin clicks "Refund" | Stripe API called; webhook fires; status updates | 🧊 |
| Cancel order | Admin clicks "Cancel" | Stock released; customer email sent | 🧊 |
| Add tracking number manually | If DHL API down | Field saves; customer email sent with tracking | 🧊 |

## Product management

| Check | Action | Expected | Status |
|---|---|---|---|
| Create product | Form with images, sizes, stock, HS code, weight | Saved; visible on storefront after publish | 🧊 |
| Edit product | Change price, stock | Storefront reflects change after cache TTL | 🧊 |
| Soft-delete product | Click delete | Hidden from storefront; orders preserve historical snapshot | 🧊 |
| Bulk stock update | CSV upload | Stock updated atomically | 🧊 |

## Marketing

| Check | Action | Expected | Status |
|---|---|---|---|
| Promo code create | Form: code, type, value, limit, expiry | Saved; usable on storefront | 🧊 |
| Newsletter subscribers | List view | Shows subscribers; CSV export works | 🧊 |
| Hero / featured collections | CMS editor | Updates reflect on `/` after publish | 🧊 |

## Ops / observability

| Check | Action | Expected | Status |
|---|---|---|---|
| `/admin/health` dashboard | Open | DB, Redis, Stripe, DHL, Royal Mail, Resend status indicators | 🧊 |
| Error tracking | Trigger 500 in dev | Sentry (or chosen tool) captures stack trace | 🧊 |
| Backup verification | Trigger restore from snapshot | Restored DB matches expected state | 🧊 |

---

# Production launch gate (🧊 final QA before go-live)

Run **everything** above ✅ before flipping prod traffic. Additional production-only checks:

| Check | Action | Expected | Status |
|---|---|---|---|
| Live Stripe keys in `.env.production` | `sk_live_...` + production webhook secret | Checkout uses real cards | 🧊 |
| Live Resend API key | `re_...` matches verified domain | Real emails dispatch | 🧊 |
| Live DHL credentials | Production env keys | Live AWB creation | 🧊 |
| TLS / cert | `https://ynotlondon.com` (or chosen domain) | Valid cert; HSTS preload | 🧊 |
| DNS | A / AAAA / CNAME / MX / TXT all set | `dig ynotlondon.com` returns expected | 🧊 |
| Cloudflare WAF | Rate limit + bot protection rules | Tested via curl | 🧊 |
| R2 / object storage | Product images + label PDFs persist | Tested upload + retrieve | 🧊 |
| Analytics | Plausible / Posthog tracking | First page view registered | 🧊 |
| Cookie consent | Banner appears on first visit | Respects refusal; doesn't fire analytics until accept | 🧊 |
| Privacy / Terms pages | Live + linked from footer | All required clauses (UK GDPR, distance selling) | 🧊 |
| First real test order | Use real card, refund afterwards | Full flow works; receipt arrives; refund clean | 🧊 |
| Backup restore drill | Pick a random day's snapshot, restore to staging | Snapshot loads; data matches | 🧊 |
| Rollback plan | Document one-click rollback for each deploy | Tested in staging | 🧊 |

---

## Editing this doc

When you tick a box, change `⏸️` → `✅`. If a check fails, change to `❌` and add a Notes row underneath with date + symptom + resolution / GitHub issue link.

When a phase ships, replace its 🧊 entries with ⏸️ (pending verification).

This doc lives in `web/docs/manual-qa.md` so it's versioned with the code.
