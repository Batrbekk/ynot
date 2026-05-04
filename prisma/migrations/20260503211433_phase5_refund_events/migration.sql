-- CreateTable
CREATE TABLE "RefundEvent" (
    "id" TEXT NOT NULL,
    "returnId" TEXT,
    "orderId" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundEvent_stripeRefundId_key" ON "RefundEvent"("stripeRefundId");

-- CreateIndex
CREATE INDEX "RefundEvent_orderId_idx" ON "RefundEvent"("orderId");

-- AddForeignKey
ALTER TABLE "RefundEvent" ADD CONSTRAINT "RefundEvent_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundEvent" ADD CONSTRAINT "RefundEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
