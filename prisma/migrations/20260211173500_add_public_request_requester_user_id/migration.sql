ALTER TABLE "PublicRequest"
ADD COLUMN "requesterUserId" UUID;

CREATE INDEX "PublicRequest_requesterUserId_idx" ON "PublicRequest"("requesterUserId");

ALTER TABLE "PublicRequest"
ADD CONSTRAINT "PublicRequest_requesterUserId_fkey"
FOREIGN KEY ("requesterUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
