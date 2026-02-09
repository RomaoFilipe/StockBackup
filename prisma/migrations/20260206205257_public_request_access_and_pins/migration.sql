-- CreateEnum
CREATE TYPE "PublicRequestStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "PublicRequestAccess" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" UUID NOT NULL,
    "requestingServiceId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID NOT NULL,

    CONSTRAINT "PublicRequestAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRequestPin" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "accessId" UUID NOT NULL,
    "label" TEXT,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID NOT NULL,

    CONSTRAINT "PublicRequestPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRequest" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PublicRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "tenantId" UUID NOT NULL,
    "accessId" UUID NOT NULL,
    "requestingServiceId" INTEGER NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterIp" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledNote" TEXT,
    "handledByUserId" UUID,
    "acceptedRequestId" UUID,

    CONSTRAINT "PublicRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRequestItem" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicRequestId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" BIGINT NOT NULL,
    "notes" TEXT,
    "unit" TEXT,

    CONSTRAINT "PublicRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicRequestAccess_slug_key" ON "PublicRequestAccess"("slug");

-- CreateIndex
CREATE INDEX "PublicRequestAccess_tenantId_idx" ON "PublicRequestAccess"("tenantId");

-- CreateIndex
CREATE INDEX "PublicRequestAccess_requestingServiceId_idx" ON "PublicRequestAccess"("requestingServiceId");

-- CreateIndex
CREATE INDEX "PublicRequestAccess_isActive_idx" ON "PublicRequestAccess"("isActive");

-- CreateIndex
CREATE INDEX "PublicRequestPin_accessId_idx" ON "PublicRequestPin"("accessId");

-- CreateIndex
CREATE INDEX "PublicRequestPin_isActive_idx" ON "PublicRequestPin"("isActive");

-- CreateIndex
CREATE INDEX "PublicRequest_tenantId_idx" ON "PublicRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PublicRequest_accessId_idx" ON "PublicRequest"("accessId");

-- CreateIndex
CREATE INDEX "PublicRequest_requestingServiceId_idx" ON "PublicRequest"("requestingServiceId");

-- CreateIndex
CREATE INDEX "PublicRequest_status_idx" ON "PublicRequest"("status");

-- CreateIndex
CREATE INDEX "PublicRequest_createdAt_idx" ON "PublicRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PublicRequestItem_publicRequestId_idx" ON "PublicRequestItem"("publicRequestId");

-- CreateIndex
CREATE INDEX "PublicRequestItem_productId_idx" ON "PublicRequestItem"("productId");

-- AddForeignKey
ALTER TABLE "PublicRequestAccess" ADD CONSTRAINT "PublicRequestAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestAccess" ADD CONSTRAINT "PublicRequestAccess_requestingServiceId_fkey" FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestAccess" ADD CONSTRAINT "PublicRequestAccess_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestPin" ADD CONSTRAINT "PublicRequestPin_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "PublicRequestAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestPin" ADD CONSTRAINT "PublicRequestPin_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "PublicRequestAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_requestingServiceId_fkey" FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequest" ADD CONSTRAINT "PublicRequest_acceptedRequestId_fkey" FOREIGN KEY ("acceptedRequestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestItem" ADD CONSTRAINT "PublicRequestItem_publicRequestId_fkey" FOREIGN KEY ("publicRequestId") REFERENCES "PublicRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRequestItem" ADD CONSTRAINT "PublicRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
