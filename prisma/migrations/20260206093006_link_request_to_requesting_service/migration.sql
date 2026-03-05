-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "requestingServiceId" INTEGER;

-- CreateIndex
CREATE INDEX "Request_requestingServiceId_idx" ON "Request"("requestingServiceId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requestingServiceId_fkey" FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
