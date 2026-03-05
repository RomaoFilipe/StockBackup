-- Add request pickup/collection signature fields
ALTER TABLE "Request"
  ADD COLUMN "pickupSignedAt" TIMESTAMP(3),
  ADD COLUMN "pickupSignedByName" TEXT,
  ADD COLUMN "pickupSignedByTitle" TEXT,
  ADD COLUMN "pickupSignatureDataUrl" TEXT;

CREATE INDEX "Request_pickupSignedAt_idx" ON "Request"("pickupSignedAt");
