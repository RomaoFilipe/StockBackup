-- Add request signature fields
ALTER TABLE "Request"
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "signedByName" TEXT,
  ADD COLUMN "signedByTitle" TEXT,
  ADD COLUMN "signedByUserId" UUID;

-- Foreign key to the actor who signed (optional)
ALTER TABLE "Request"
  ADD CONSTRAINT "Request_signedByUserId_fkey"
  FOREIGN KEY ("signedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Request_signedAt_idx" ON "Request"("signedAt");
CREATE INDEX "Request_signedByUserId_idx" ON "Request"("signedByUserId");
