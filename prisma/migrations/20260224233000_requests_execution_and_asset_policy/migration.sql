-- Request execution hardening + asset policy/mapping

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "isPatrimonializable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AssetCategoryClassMap" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "classId" UUID NOT NULL,
  CONSTRAINT "AssetCategoryClassMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssetPolicy" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "requireTransferApproval" BOOLEAN NOT NULL DEFAULT true,
  "requireDisposalApproval" BOOLEAN NOT NULL DEFAULT true,
  "transferApproverRoleKey" VARCHAR(120),
  "disposalApproverRoleKey" VARCHAR(120),
  CONSTRAINT "AssetPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RequestExecution" (
  "id" UUID NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "notes" TEXT,
  "documentRef" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "executedByUserId" UUID,
  CONSTRAINT "RequestExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssetCategoryClassMap_tenantId_categoryId_key"
  ON "AssetCategoryClassMap"("tenantId", "categoryId");
CREATE INDEX IF NOT EXISTS "AssetCategoryClassMap_tenantId_idx" ON "AssetCategoryClassMap"("tenantId");
CREATE INDEX IF NOT EXISTS "AssetCategoryClassMap_categoryId_idx" ON "AssetCategoryClassMap"("categoryId");
CREATE INDEX IF NOT EXISTS "AssetCategoryClassMap_classId_idx" ON "AssetCategoryClassMap"("classId");

CREATE UNIQUE INDEX IF NOT EXISTS "AssetPolicy_tenantId_key" ON "AssetPolicy"("tenantId");
CREATE INDEX IF NOT EXISTS "AssetPolicy_tenantId_idx" ON "AssetPolicy"("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "RequestExecution_tenantId_idempotencyKey_key"
  ON "RequestExecution"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "RequestExecution_tenantId_idx" ON "RequestExecution"("tenantId");
CREATE INDEX IF NOT EXISTS "RequestExecution_requestId_idx" ON "RequestExecution"("requestId");
CREATE INDEX IF NOT EXISTS "RequestExecution_executedByUserId_idx" ON "RequestExecution"("executedByUserId");
CREATE INDEX IF NOT EXISTS "RequestExecution_createdAt_idx" ON "RequestExecution"("createdAt");

ALTER TABLE "AssetCategoryClassMap"
  ADD CONSTRAINT "AssetCategoryClassMap_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssetCategoryClassMap_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AssetCategoryClassMap_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "MunicipalAssetClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetPolicy"
  ADD CONSTRAINT "AssetPolicy_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestExecution"
  ADD CONSTRAINT "RequestExecution_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RequestExecution_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RequestExecution_executedByUserId_fkey"
  FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
