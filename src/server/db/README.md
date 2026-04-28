# Server DB layer

`client.ts` exports the singleton `PrismaClient`. Every server module that
talks to Postgres imports `prisma` from here — never construct a new client.

`transaction.ts` exports `withTransaction(fn)` for multi-row atomic writes.

## Migration workflow

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate` — Prisma diffs against the dev DB and creates a migration.
3. Name the migration with an imperative phrase (e.g. `add_review_table`,
   `backfill_order_utm`).
4. Commit `prisma/schema.prisma` AND every file under `prisma/migrations/`.
5. For partial indexes, generated columns, or anything Prisma cannot express,
   use `pnpm prisma migrate dev --create-only --name <topic>`, edit the empty
   `migration.sql` by hand, then run `pnpm db:migrate` to apply.

Production deploys run `pnpm db:migrate:deploy` (no schema diff, just applies
pending migrations) — wired up in Phase "Deploy & Ops".

## Script naming caveat

`db:migrate:deploy` runs `prisma migrate deploy` against `.env.production` —
i.e. the *production environment*. The `:deploy` suffix refers to the Prisma
sub-command, not the Git "deploy" verb. Do not run it locally without intent.
For test-environment migrations use `db:migrate:test`.
