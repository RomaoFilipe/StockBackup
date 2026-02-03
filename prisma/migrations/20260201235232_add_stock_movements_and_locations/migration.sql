/*
  Warnings:

  - You are about to drop the column `deliveryLocation` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryLocationId` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryWindowFrom` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryWindowTo` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `requestNumber` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `requestedAt` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `requesterNameSnapshot` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `serviceId` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `serviceName` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `itemDescSnapshot` on the `RequestItem` table. All the data in the column will be lost.
  - You are about to drop the column `itemNameSnapshot` on the `RequestItem` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `RequestItem` table. All the data in the column will be lost.
  - You are about to drop the `Item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RequestSupplier` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST', 'TRANSFER');

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_userId_fkey";

-- DropForeignKey
ALTER TABLE "RequestSupplier" DROP CONSTRAINT "RequestSupplier_requestId_fkey";

-- DropForeignKey
ALTER TABLE "RequestSupplier" DROP CONSTRAINT "RequestSupplier_supplierId_fkey";

-- DropIndex
DROP INDEX "Request_requestNumber_key";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "deliveryLocation",
DROP COLUMN "deliveryLocationId",
DROP COLUMN "deliveryWindowFrom",
DROP COLUMN "deliveryWindowTo",
DROP COLUMN "requestNumber",
DROP COLUMN "requestedAt",
DROP COLUMN "requesterNameSnapshot",
DROP COLUMN "serviceId",
DROP COLUMN "serviceName",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "RequestItem" DROP COLUMN "itemDescSnapshot",
DROP COLUMN "itemNameSnapshot",
DROP COLUMN "unit";

-- DropTable
DROP TABLE "Item";

-- DropTable
DROP TABLE "RequestSupplier";

-- DropEnum
DROP TYPE "ItemType";

-- DropEnum
DROP TYPE "RequestType";

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" UUID NOT NULL,
    "quantity" BIGINT NOT NULL DEFAULT 0,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityDelta" BIGINT NOT NULL,
    "reason" TEXT,
    "transferGroupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Warehouse_userId_idx" ON "Warehouse"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_userId_name_key" ON "Warehouse"("userId", "name");

-- CreateIndex
CREATE INDEX "Location_userId_idx" ON "Location"("userId");

-- CreateIndex
CREATE INDEX "Location_warehouseId_idx" ON "Location"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_userId_code_key" ON "Location"("userId", "code");

-- CreateIndex
CREATE INDEX "InventoryBalance_userId_idx" ON "InventoryBalance"("userId");

-- CreateIndex
CREATE INDEX "InventoryBalance_productId_idx" ON "InventoryBalance"("productId");

-- CreateIndex
CREATE INDEX "InventoryBalance_locationId_idx" ON "InventoryBalance"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_productId_locationId_key" ON "InventoryBalance"("productId", "locationId");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_idx" ON "StockMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_idx" ON "StockMovement"("locationId");

-- CreateIndex
CREATE INDEX "StockMovement_transferGroupId_idx" ON "StockMovement"("transferGroupId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
