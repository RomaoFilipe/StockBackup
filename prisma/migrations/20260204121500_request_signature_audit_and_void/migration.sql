-- Add audit and voiding fields for request signatures
ALTER TABLE "Request"
  ADD COLUMN "signedIp" TEXT,
  ADD COLUMN "signedUserAgent" TEXT,
  ADD COLUMN "signedVoidedAt" TIMESTAMP(3),
  ADD COLUMN "signedVoidedReason" TEXT,
  ADD COLUMN "signedVoidedByUserId" UUID,
  ADD COLUMN "pickupSignedIp" TEXT,
  ADD COLUMN "pickupSignedUserAgent" TEXT,
  ADD COLUMN "pickupRecordedByUserId" UUID,
  ADD COLUMN "pickupVoidedAt" TIMESTAMP(3),
  ADD COLUMN "pickupVoidedReason" TEXT,
  ADD COLUMN "pickupVoidedByUserId" UUID;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_signedVoidedByUserId_fkey"
  FOREIGN KEY ("signedVoidedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_pickupRecordedByUserId_fkey"
  FOREIGN KEY ("pickupRecordedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_pickupVoidedByUserId_fkey"
  FOREIGN KEY ("pickupVoidedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Request_signedVoidedAt_idx" ON "Request"("signedVoidedAt");
CREATE INDEX "Request_signedVoidedByUserId_idx" ON "Request"("signedVoidedByUserId");
CREATE INDEX "Request_pickupRecordedByUserId_idx" ON "Request"("pickupRecordedByUserId");
CREATE INDEX "Request_pickupVoidedAt_idx" ON "Request"("pickupVoidedAt");
CREATE INDEX "Request_pickupVoidedByUserId_idx" ON "Request"("pickupVoidedByUserId");
