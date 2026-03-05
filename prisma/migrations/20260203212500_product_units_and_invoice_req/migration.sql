/*
  Warnings:

  - You are about to drop the `InventoryBalance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockMovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Warehouse` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProductUnitStatus" AS ENUM ('IN_STOCK', 'ACQUIRED');

-- DropForeignKey
ALTER TABLE "InventoryBalance" DROP CONSTRAINT "InventoryBalance_locationId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBalance" DROP CONSTRAINT "InventoryBalance_productId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBalance" DROP CONSTRAINT "InventoryBalance_userId_fkey";

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_userId_fkey";

-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_locationId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_userId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "ProductInvoice" ADD COLUMN     "reqNumber" TEXT;

-- DropTable
DROP TABLE "InventoryBalance";

-- DropTable
DROP TABLE "Location";

-- DropTable
DROP TABLE "StockMovement";

-- DropTable
DROP TABLE "Warehouse";

-- DropEnum
DROP TYPE "StockMovementType";

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ProductUnitStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acquiredAt" TIMESTAMP(3),
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "invoiceId" UUID,
    "acquiredByUserId" UUID,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_code_key" ON "ProductUnit"("code");

-- CreateIndex
CREATE INDEX "ProductUnit_userId_idx" ON "ProductUnit"("userId");

-- CreateIndex
CREATE INDEX "ProductUnit_productId_idx" ON "ProductUnit"("productId");

-- CreateIndex
CREATE INDEX "ProductUnit_invoiceId_idx" ON "ProductUnit"("invoiceId");

-- CreateIndex
CREATE INDEX "ProductUnit_acquiredByUserId_idx" ON "ProductUnit"("acquiredByUserId");

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ProductInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_acquiredByUserId_fkey" FOREIGN KEY ("acquiredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
