-- AlterTable
ALTER TABLE "User" ADD COLUMN     "requestingServiceId" INTEGER;

-- CreateIndex
CREATE INDEX "User_requestingServiceId_idx" ON "User"("requestingServiceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_requestingServiceId_fkey" FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
