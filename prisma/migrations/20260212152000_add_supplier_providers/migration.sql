-- CreateTable
CREATE TABLE "SupplierProvider" (
  "id" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "role" VARCHAR(120),
  "email" VARCHAR(255),
  "phone" VARCHAR(60),
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" UUID NOT NULL,
  CONSTRAINT "SupplierProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProvider_userId_supplierId_name_key" ON "SupplierProvider"("userId", "supplierId", "name");
CREATE INDEX "SupplierProvider_userId_idx" ON "SupplierProvider"("userId");
CREATE INDEX "SupplierProvider_supplierId_idx" ON "SupplierProvider"("supplierId");
CREATE INDEX "SupplierProvider_isActive_idx" ON "SupplierProvider"("isActive");

-- AddForeignKey
ALTER TABLE "SupplierProvider"
  ADD CONSTRAINT "SupplierProvider_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierProvider"
  ADD CONSTRAINT "SupplierProvider_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
