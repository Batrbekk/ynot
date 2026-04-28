import { prisma } from "../../db/client";

/**
 * Truncate every table except Prisma's _prisma_migrations.
 * Cheaper than `prisma migrate reset` and faster than per-table deletes.
 *
 * Usage:
 *   beforeEach(() => resetDb());
 */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
