-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "requestId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_requestId_key" ON "Ticket"("requestId");

-- CreateIndex
CREATE INDEX "Ticket_requestId_idx" ON "Ticket"("requestId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
