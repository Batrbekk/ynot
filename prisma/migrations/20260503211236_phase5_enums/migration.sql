-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'AWAITING_PARCEL', 'RECEIVED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DOES_NOT_FIT', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'DEFECTIVE', 'ARRIVED_DAMAGED', 'WRONG_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_DELIVERED';
