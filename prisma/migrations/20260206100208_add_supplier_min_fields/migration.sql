-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactName" VARCHAR(120),
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nif" VARCHAR(30),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" VARCHAR(60);

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");
