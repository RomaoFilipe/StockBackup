-- Drop old single-link relationship if present
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_requestId_fkey";
DROP INDEX IF EXISTS "Ticket_requestId_key";
DROP INDEX IF EXISTS "Ticket_requestId_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "requestId";

-- CreateTable
CREATE TABLE "TicketRequestLink" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "linkedByUserId" UUID,

    CONSTRAINT "TicketRequestLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAudit" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(80) NOT NULL,
    "note" TEXT,
    "data" JSONB,
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorUserId" UUID,

    CONSTRAINT "TicketAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketRequestLink_ticketId_requestId_key" ON "TicketRequestLink"("ticketId", "requestId");

-- CreateIndex
CREATE INDEX "TicketRequestLink_tenantId_idx" ON "TicketRequestLink"("tenantId");

-- CreateIndex
CREATE INDEX "TicketRequestLink_ticketId_idx" ON "TicketRequestLink"("ticketId");

-- CreateIndex
CREATE INDEX "TicketRequestLink_requestId_idx" ON "TicketRequestLink"("requestId");

-- CreateIndex
CREATE INDEX "TicketRequestLink_createdAt_idx" ON "TicketRequestLink"("createdAt");

-- CreateIndex
CREATE INDEX "TicketAudit_tenantId_idx" ON "TicketAudit"("tenantId");

-- CreateIndex
CREATE INDEX "TicketAudit_ticketId_idx" ON "TicketAudit"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAudit_actorUserId_idx" ON "TicketAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "TicketAudit_createdAt_idx" ON "TicketAudit"("createdAt");

-- CreateIndex
CREATE INDEX "TicketAudit_action_idx" ON "TicketAudit"("action");

-- AddForeignKey
ALTER TABLE "TicketRequestLink" ADD CONSTRAINT "TicketRequestLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRequestLink" ADD CONSTRAINT "TicketRequestLink_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRequestLink" ADD CONSTRAINT "TicketRequestLink_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketRequestLink" ADD CONSTRAINT "TicketRequestLink_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAudit" ADD CONSTRAINT "TicketAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAudit" ADD CONSTRAINT "TicketAudit_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAudit" ADD CONSTRAINT "TicketAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
