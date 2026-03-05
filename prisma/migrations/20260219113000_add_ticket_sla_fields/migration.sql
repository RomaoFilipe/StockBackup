-- AlterTable
ALTER TABLE "Ticket"
ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
ADD COLUMN "slaBreachedAt" TIMESTAMP(3),
ADD COLUMN "lastEscalatedAt" TIMESTAMP(3),
ADD COLUMN "slaEscalationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Ticket_firstResponseDueAt_idx" ON "Ticket"("firstResponseDueAt");

-- CreateIndex
CREATE INDEX "Ticket_resolutionDueAt_idx" ON "Ticket"("resolutionDueAt");

-- CreateIndex
CREATE INDEX "Ticket_lastEscalatedAt_idx" ON "Ticket"("lastEscalatedAt");
