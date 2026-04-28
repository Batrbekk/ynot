-- HeroBlock.isActive partial unique — Prisma's @@unique cannot express WHERE clauses.
-- This index guarantees at most one row with isActive = true at a time.
CREATE UNIQUE INDEX "hero_block_one_active"
  ON "HeroBlock" ("isActive")
  WHERE "isActive" = true;
