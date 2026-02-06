-- AlterTable
ALTER TABLE "ProductInvoice" ADD COLUMN     "requestingServiceId" INTEGER;

-- CreateTable
CREATE TABLE "servicos_requisitantes" (
    "id" INTEGER NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "designacao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "servicos_requisitantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servicos_requisitantes_ativo_idx" ON "servicos_requisitantes"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_requisitantes_codigo_key" ON "servicos_requisitantes"("codigo");

-- CreateIndex
CREATE INDEX "ProductInvoice_requestingServiceId_idx" ON "ProductInvoice"("requestingServiceId");

-- AddForeignKey
ALTER TABLE "ProductInvoice" ADD CONSTRAINT "ProductInvoice_requestingServiceId_fkey" FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
