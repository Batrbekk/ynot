-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dispatchAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailJob_dispatchAt_status_idx" ON "EmailJob"("dispatchAt", "status");

-- CreateIndex
CREATE INDEX "EmailJob_template_status_idx" ON "EmailJob"("template", "status");
