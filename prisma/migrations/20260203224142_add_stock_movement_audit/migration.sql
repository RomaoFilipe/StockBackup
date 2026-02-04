-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "acquiredNotes" TEXT,
ADD COLUMN     "acquiredReason" TEXT,
ADD COLUMN     "assignedToUserId" UUID,
ADD COLUMN     "costCenter" TEXT;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" BIGINT NOT NULL,
    "reason" TEXT,
    "costCenter" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "unitId" UUID,
    "invoiceId" UUID,
    "requestId" UUID,
    "performedByUserId" UUID,
    "assignedToUserId" UUID,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_unitId_idx" ON "StockMovement"("unitId");

-- CreateIndex
CREATE INDEX "StockMovement_invoiceId_idx" ON "StockMovement"("invoiceId");

-- CreateIndex
CREATE INDEX "StockMovement_requestId_idx" ON "StockMovement"("requestId");

-- CreateIndex
CREATE INDEX "StockMovement_performedByUserId_idx" ON "StockMovement"("performedByUserId");

-- CreateIndex
CREATE INDEX "StockMovement_assignedToUserId_idx" ON "StockMovement"("assignedToUserId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "ProductUnit_assignedToUserId_idx" ON "ProductUnit"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ProductInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
