-- Add optional linkage between PublicRequest and Ticket for auto-association on acceptance.
ALTER TABLE "PublicRequest"
ADD COLUMN "ticketId" UUID;

ALTER TABLE "PublicRequest"
ADD CONSTRAINT "PublicRequest_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PublicRequest_ticketId_idx" ON "PublicRequest"("ticketId");

