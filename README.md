# ynot

A production-grade **e-commerce storefront** built on the latest Next.js App Router — full catalog, cart, checkout, payments, and order fulfilment in a single, strictly-typed TypeScript codebase.

## Highlights

- **Storefront & catalog** — products with sizes, colour options, categories, lookbooks, editorial hero blocks and static pages
- **Cart & checkout** — persistent carts, cart-event tracking, promo codes and pre-order batches
- **Payments** — Stripe (Payment Intents + webhooks)
- **Orders & fulfilment** — full order lifecycle, shipments, carrier tracking, returns & refunds
- **Auth** — NextAuth (credentials + Prisma adapter) with role-based access
- **Transactional email** — React Email templates delivered through Resend
- **Background jobs** — `node-cron` workers backed by Redis (ioredis) for queues & caching
- **Observability** — Sentry error & performance monitoring
- **Quality** — Playwright end-to-end tests, unit/integration tests, ESLint and strict TypeScript

## Tech stack

`Next.js 15` · `TypeScript` · `Prisma` · `PostgreSQL` · `Stripe` · `NextAuth` · `Redis` · `Resend / React Email` · `Sentry` · `Zustand` · `Tailwind CSS` · `Playwright` · `Docker`

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in the required values

pnpm db:up                  # start Postgres/Redis via docker-compose
pnpm db:migrate             # apply Prisma migrations
pnpm db:seed                # seed demo data

pnpm dev                    # http://localhost:3000
```

## Useful scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the development server |
| `pnpm build` / `pnpm start` | Production build & serve |
| `pnpm test` / `pnpm test:watch` | Run the test suite |
| `pnpm typecheck` | Strict TypeScript check |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:reset` | Reset & reseed the database |
| `pnpm email` | Preview React Email templates |

## Project structure

```
app/        Next.js App Router routes (storefront, checkout, account, admin)
prisma/     Schema, migrations & seed
e2e/        Playwright end-to-end tests
```

---

Built with ❤️ by [Batyrbek Kuandyk](https://github.com/Batrbekk).
