-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "promoCodeId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "countryOfOriginCode" TEXT,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "weightGrams" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StripeEvent_createdAt_idx" ON "StripeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 1 §241 specified an order_number_seq for YN-YYYY-NNNNN format. The init
-- migration omitted it; Phase 4 adds it now.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Existing demo SKUs get placeholder physical attributes so DHL Phase 5 has data.
UPDATE "Product"
SET    "weightGrams" = 1500,
       "hsCode" = '6202.93',
       "countryOfOriginCode" = 'GB'
WHERE  "weightGrams" IS NULL;

-- Backfill safety: any pre-existing Orders are paid orders → keep them as NEW.
-- (Phase 1 had no live orders; only fixtures. This is defensive.)
-- No data change needed because the enum was extended, not reordered.
