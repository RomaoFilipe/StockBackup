-- Expand municipal asset governance: catalog, locations, movements, disposal process,
-- and explicit linkage to Product/ProductUnit.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MunicipalAssetCriticality') THEN
    CREATE TYPE "MunicipalAssetCriticality" AS ENUM ('OPERATIONAL', 'SECURITY', 'ESSENTIAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MunicipalAssetDepreciationMethod') THEN
    CREATE TYPE "MunicipalAssetDepreciationMethod" AS ENUM ('NONE', 'STRAIGHT_LINE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MunicipalAssetMovementType') THEN
    CREATE TYPE "MunicipalAssetMovementType" AS ENUM (
      'REGISTER',
      'ASSIGN',
      'TRANSFER',
      'STOCK_IN',
      'STOCK_OUT',
      'LOAN_OUT',
      'LOAN_RETURN',
      'REPAIR_OUT',
      'REPAIR_IN',
      'STATUS_CHANGE',
      'DISPOSAL_INIT',
      'DISPOSAL_APPROVED',
      'DISPOSED',
      'NOTE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MunicipalAssetDisposalStatus') THEN
    CREATE TYPE "MunicipalAssetDisposalStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');
  END IF;
END $$;

ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'IN_SERVICE';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'IN_REPAIR';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'LOANED';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'LOST';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'STOLEN';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'TO_DISPOSE';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED_OUT';
ALTER TYPE "MunicipalAssetStatus" ADD VALUE IF NOT EXISTS 'DONATED';

CREATE TABLE IF NOT EXISTS "MunicipalAssetClass" (
  "id" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "requiresSerialNumber" BOOLEAN NOT NULL DEFAULT false,
  "defaultUsefulLifeMonths" INTEGER,
  "defaultDepreciationMethod" "MunicipalAssetDepreciationMethod",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  CONSTRAINT "MunicipalAssetClass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MunicipalAssetModel" (
  "id" UUID NOT NULL,
  "brand" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "classId" UUID,
  CONSTRAINT "MunicipalAssetModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MunicipalAssetLocation" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80),
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "parentId" UUID,
  CONSTRAINT "MunicipalAssetLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MunicipalAssetMovement" (
  "id" UUID NOT NULL,
  "type" "MunicipalAssetMovementType" NOT NULL,
  "statusFrom" "MunicipalAssetStatus",
  "statusTo" "MunicipalAssetStatus",
  "movementAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "note" TEXT,
  "reason" TEXT,
  "vendorName" TEXT,
  "cost" DOUBLE PRECISION,
  "documentRef" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "actorUserId" UUID,
  "fromRequestingServiceId" INTEGER,
  "toRequestingServiceId" INTEGER,
  "fromLocationId" UUID,
  "toLocationId" UUID,
  "fromCustodianUserId" UUID,
  "toCustodianUserId" UUID,
  CONSTRAINT "MunicipalAssetMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MunicipalAssetDisposalProcess" (
  "id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "status" "MunicipalAssetDisposalStatus" NOT NULL DEFAULT 'DRAFT',
  "reasonCode" VARCHAR(80) NOT NULL,
  "reasonDetail" TEXT,
  "technicalEvaluation" TEXT,
  "estimatedValue" DOUBLE PRECISION,
  "decisionNote" TEXT,
  "destination" TEXT,
  "documentRef" TEXT,
  "attachments" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "openedByUserId" UUID,
  "decidedByUserId" UUID,
  CONSTRAINT "MunicipalAssetDisposalProcess_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MunicipalAsset"
  ADD COLUMN IF NOT EXISTS "serialNumber" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "assetTag" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "criticality" "MunicipalAssetCriticality" NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN IF NOT EXISTS "usefulLifeMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "depreciationMethod" "MunicipalAssetDepreciationMethod" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "productId" UUID,
  ADD COLUMN IF NOT EXISTS "productUnitId" UUID,
  ADD COLUMN IF NOT EXISTS "classId" UUID,
  ADD COLUMN IF NOT EXISTS "modelId" UUID,
  ADD COLUMN IF NOT EXISTS "locationId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetClass_tenantId_key_key" ON "MunicipalAssetClass"("tenantId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetClass_tenantId_name_key" ON "MunicipalAssetClass"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "MunicipalAssetClass_tenantId_idx" ON "MunicipalAssetClass"("tenantId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetClass_isActive_idx" ON "MunicipalAssetClass"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetModel_tenantId_brand_model_key" ON "MunicipalAssetModel"("tenantId", "brand", "model");
CREATE INDEX IF NOT EXISTS "MunicipalAssetModel_tenantId_idx" ON "MunicipalAssetModel"("tenantId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetModel_classId_idx" ON "MunicipalAssetModel"("classId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetModel_isActive_idx" ON "MunicipalAssetModel"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetLocation_tenantId_code_key" ON "MunicipalAssetLocation"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetLocation_tenantId_parentId_name_key" ON "MunicipalAssetLocation"("tenantId", "parentId", "name");
CREATE INDEX IF NOT EXISTS "MunicipalAssetLocation_tenantId_idx" ON "MunicipalAssetLocation"("tenantId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetLocation_parentId_idx" ON "MunicipalAssetLocation"("parentId");

CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAsset_tenantId_serialNumber_key" ON "MunicipalAsset"("tenantId", "serialNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAsset_tenantId_assetTag_key" ON "MunicipalAsset"("tenantId", "assetTag");
CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAsset_tenantId_productUnitId_key" ON "MunicipalAsset"("tenantId", "productUnitId");
CREATE INDEX IF NOT EXISTS "MunicipalAsset_productId_idx" ON "MunicipalAsset"("productId");
CREATE INDEX IF NOT EXISTS "MunicipalAsset_classId_idx" ON "MunicipalAsset"("classId");
CREATE INDEX IF NOT EXISTS "MunicipalAsset_modelId_idx" ON "MunicipalAsset"("modelId");
CREATE INDEX IF NOT EXISTS "MunicipalAsset_locationId_idx" ON "MunicipalAsset"("locationId");
CREATE INDEX IF NOT EXISTS "MunicipalAsset_criticality_idx" ON "MunicipalAsset"("criticality");

CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_tenantId_idx" ON "MunicipalAssetMovement"("tenantId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_assetId_idx" ON "MunicipalAssetMovement"("assetId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_type_idx" ON "MunicipalAssetMovement"("type");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_movementAt_idx" ON "MunicipalAssetMovement"("movementAt");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_actorUserId_idx" ON "MunicipalAssetMovement"("actorUserId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_fromRequestingServiceId_idx" ON "MunicipalAssetMovement"("fromRequestingServiceId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_toRequestingServiceId_idx" ON "MunicipalAssetMovement"("toRequestingServiceId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_fromLocationId_idx" ON "MunicipalAssetMovement"("fromLocationId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_toLocationId_idx" ON "MunicipalAssetMovement"("toLocationId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_fromCustodianUserId_idx" ON "MunicipalAssetMovement"("fromCustodianUserId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetMovement_toCustodianUserId_idx" ON "MunicipalAssetMovement"("toCustodianUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_tenantId_code_key" ON "MunicipalAssetDisposalProcess"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_tenantId_idx" ON "MunicipalAssetDisposalProcess"("tenantId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_assetId_idx" ON "MunicipalAssetDisposalProcess"("assetId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_status_idx" ON "MunicipalAssetDisposalProcess"("status");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_openedByUserId_idx" ON "MunicipalAssetDisposalProcess"("openedByUserId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_decidedByUserId_idx" ON "MunicipalAssetDisposalProcess"("decidedByUserId");
CREATE INDEX IF NOT EXISTS "MunicipalAssetDisposalProcess_openedAt_idx" ON "MunicipalAssetDisposalProcess"("openedAt");

ALTER TABLE "MunicipalAssetClass"
  ADD CONSTRAINT "MunicipalAssetClass_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetModel"
  ADD CONSTRAINT "MunicipalAssetModel_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetModel_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "MunicipalAssetClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetLocation"
  ADD CONSTRAINT "MunicipalAssetLocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetLocation_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "MunicipalAssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAsset"
  ADD CONSTRAINT "MunicipalAsset_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAsset_productUnitId_fkey"
  FOREIGN KEY ("productUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAsset_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "MunicipalAssetClass"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAsset_modelId_fkey"
  FOREIGN KEY ("modelId") REFERENCES "MunicipalAssetModel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAsset_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "MunicipalAssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetMovement"
  ADD CONSTRAINT "MunicipalAssetMovement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MunicipalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_fromRequestingServiceId_fkey"
  FOREIGN KEY ("fromRequestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_toRequestingServiceId_fkey"
  FOREIGN KEY ("toRequestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_fromLocationId_fkey"
  FOREIGN KEY ("fromLocationId") REFERENCES "MunicipalAssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_toLocationId_fkey"
  FOREIGN KEY ("toLocationId") REFERENCES "MunicipalAssetLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_fromCustodianUserId_fkey"
  FOREIGN KEY ("fromCustodianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetMovement_toCustodianUserId_fkey"
  FOREIGN KEY ("toCustodianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetDisposalProcess"
  ADD CONSTRAINT "MunicipalAssetDisposalProcess_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetDisposalProcess_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MunicipalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetDisposalProcess_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MunicipalAssetDisposalProcess_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
