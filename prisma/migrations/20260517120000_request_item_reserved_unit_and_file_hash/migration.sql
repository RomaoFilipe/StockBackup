ALTER TABLE "RequestItem" ADD COLUMN "reservedUnitId" UUID;

ALTER TABLE "StoredFile" ADD COLUMN "sha256" TEXT;

CREATE INDEX "RequestItem_reservedUnitId_idx" ON "RequestItem"("reservedUnitId");

CREATE INDEX "StoredFile_sha256_idx" ON "StoredFile"("sha256");

ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_reservedUnitId_fkey"
  FOREIGN KEY ("reservedUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
