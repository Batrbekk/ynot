-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "preorderBatchId" TEXT;

-- CreateIndex
CREATE INDEX "CartItem_preorderBatchId_idx" ON "CartItem"("preorderBatchId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_preorderBatchId_fkey" FOREIGN KEY ("preorderBatchId") REFERENCES "PreorderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
