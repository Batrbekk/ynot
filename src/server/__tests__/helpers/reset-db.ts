import { prisma } from "../../db/client";
import { redis } from "../../redis";

/**
 * Truncate every table except Prisma's _prisma_migrations and clear all
 * `ratelimit:*` keys from Redis. Cheaper than `prisma migrate reset` and
 * faster than per-table deletes.
 *
 * Usage:
 *   beforeEach(() => resetDb());
 */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
  const rateLimitKeys = await redis.keys("ratelimit:*");
  if (rateLimitKeys.length > 0) {
    await redis.del(...rateLimitKeys);
  }
}
