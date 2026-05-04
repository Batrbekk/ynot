-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "shipmentId" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_shipmentId_idx" ON "OrderItem"("shipmentId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
