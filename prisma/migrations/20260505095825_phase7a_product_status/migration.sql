-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill existing non-deleted products to PUBLISHED
UPDATE "Product"
SET "status" = 'PUBLISHED',
    "publishedAt" = "createdAt"
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Product_status_deletedAt_idx" ON "Product"("status", "deletedAt");
