-- CreateTable
CREATE TABLE "TicketParticipant" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "addedByUserId" UUID,

    CONSTRAINT "TicketParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketParticipant_tenantId_idx" ON "TicketParticipant"("tenantId");

-- CreateIndex
CREATE INDEX "TicketParticipant_ticketId_idx" ON "TicketParticipant"("ticketId");

-- CreateIndex
CREATE INDEX "TicketParticipant_userId_idx" ON "TicketParticipant"("userId");

-- CreateIndex
CREATE INDEX "TicketParticipant_createdAt_idx" ON "TicketParticipant"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketParticipant_ticketId_userId_key" ON "TicketParticipant"("ticketId", "userId");

-- AddForeignKey
ALTER TABLE "TicketParticipant" ADD CONSTRAINT "TicketParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketParticipant" ADD CONSTRAINT "TicketParticipant_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketParticipant" ADD CONSTRAINT "TicketParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketParticipant" ADD CONSTRAINT "TicketParticipant_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
