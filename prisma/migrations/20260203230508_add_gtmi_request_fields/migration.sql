/*
  Warnings:

  - A unique constraint covering the columns `[userId,gtmiNumber]` on the table `Request` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,gtmiYear,gtmiSeq]` on the table `Request` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gtmiNumber` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gtmiSeq` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gtmiYear` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RequestGoodsType" AS ENUM ('MATERIALS_SERVICES', 'WAREHOUSE_MATERIALS', 'OTHER_PRODUCTS');

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "deliveryLocation" TEXT,
ADD COLUMN     "expectedDeliveryFrom" TIMESTAMP(3),
ADD COLUMN     "expectedDeliveryTo" TIMESTAMP(3),
ADD COLUMN     "goodsTypes" "RequestGoodsType"[] DEFAULT ARRAY[]::"RequestGoodsType"[],
ADD COLUMN     "gtmiNumber" TEXT NOT NULL,
ADD COLUMN     "gtmiSeq" INTEGER NOT NULL,
ADD COLUMN     "gtmiYear" INTEGER NOT NULL,
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requesterEmployeeNo" TEXT,
ADD COLUMN     "requesterName" TEXT,
ADD COLUMN     "requestingService" TEXT,
ADD COLUMN     "supplierOption1" TEXT,
ADD COLUMN     "supplierOption2" TEXT,
ADD COLUMN     "supplierOption3" TEXT;

-- AlterTable
ALTER TABLE "RequestItem" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateIndex
CREATE INDEX "Request_requestedAt_idx" ON "Request"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Request_userId_gtmiNumber_key" ON "Request"("userId", "gtmiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Request_userId_gtmiYear_gtmiSeq_key" ON "Request"("userId", "gtmiYear", "gtmiSeq");
