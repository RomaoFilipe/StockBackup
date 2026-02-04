-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN
    "assetTag" TEXT,
ADD COLUMN
    "notes" TEXT,
ADD COLUMN
    "partNumber" TEXT,
ADD COLUMN
    "serialNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_userId_serialNumber_key" ON "ProductUnit"("userId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_userId_partNumber_key" ON "ProductUnit"("userId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_userId_assetTag_key" ON "ProductUnit"("userId", "assetTag");
