-- Phase 2-5 foundation: workflow engine, assets, finance, presidency dispatch, RBAC audit

-- Enums
CREATE TYPE "WorkflowTargetType" AS ENUM ('REQUEST', 'PUBLIC_REQUEST', 'MUNICIPAL_ASSET', 'FINANCE_PROCESS');
CREATE TYPE "MunicipalAssetStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'ASSIGNED', 'MAINTENANCE', 'SCRAPPED', 'DISPOSED');
CREATE TYPE "FinanceProcessStatus" AS ENUM ('DRAFT', 'CABIMENTO', 'COMPROMISSO', 'APPROVED', 'PAYMENT_AUTHORIZED', 'PAID', 'REJECTED');
CREATE TYPE "PresidencyDispatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- RBAC audit
CREATE TABLE "RbacAudit" (
  "id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "payload" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "actorUserId" UUID,
  CONSTRAINT "RbacAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RbacAudit_tenantId_idx" ON "RbacAudit"("tenantId");
CREATE INDEX "RbacAudit_actorUserId_idx" ON "RbacAudit"("actorUserId");
CREATE INDEX "RbacAudit_createdAt_idx" ON "RbacAudit"("createdAt");
CREATE INDEX "RbacAudit_action_idx" ON "RbacAudit"("action");

ALTER TABLE "RbacAudit"
  ADD CONSTRAINT "RbacAudit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RbacAudit"
  ADD CONSTRAINT "RbacAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Workflow engine
CREATE TABLE "WorkflowDefinition" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "targetType" "WorkflowTargetType" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowDefinition_tenantId_key_version_key" ON "WorkflowDefinition"("tenantId", "key", "version");
CREATE INDEX "WorkflowDefinition_tenantId_idx" ON "WorkflowDefinition"("tenantId");
CREATE INDEX "WorkflowDefinition_targetType_idx" ON "WorkflowDefinition"("targetType");
CREATE INDEX "WorkflowDefinition_isActive_idx" ON "WorkflowDefinition"("isActive");

ALTER TABLE "WorkflowDefinition"
  ADD CONSTRAINT "WorkflowDefinition_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowStateDefinition" (
  "id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "isInitial" BOOLEAN NOT NULL DEFAULT false,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "requestStatus" "RequestStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  CONSTRAINT "WorkflowStateDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStateDefinition_workflowId_code_key" ON "WorkflowStateDefinition"("workflowId", "code");
CREATE INDEX "WorkflowStateDefinition_tenantId_idx" ON "WorkflowStateDefinition"("tenantId");
CREATE INDEX "WorkflowStateDefinition_workflowId_sortOrder_idx" ON "WorkflowStateDefinition"("workflowId", "sortOrder");
CREATE INDEX "WorkflowStateDefinition_requestStatus_idx" ON "WorkflowStateDefinition"("requestStatus");

ALTER TABLE "WorkflowStateDefinition"
  ADD CONSTRAINT "WorkflowStateDefinition_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowStateDefinition"
  ADD CONSTRAINT "WorkflowStateDefinition_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowTransitionDefinition" (
  "id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "requiredPermission" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "fromStateId" UUID NOT NULL,
  "toStateId" UUID NOT NULL,
  CONSTRAINT "WorkflowTransitionDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTransitionDefinition_workflowId_fromStateId_action_key" ON "WorkflowTransitionDefinition"("workflowId", "fromStateId", "action");
CREATE INDEX "WorkflowTransitionDefinition_tenantId_idx" ON "WorkflowTransitionDefinition"("tenantId");
CREATE INDEX "WorkflowTransitionDefinition_workflowId_idx" ON "WorkflowTransitionDefinition"("workflowId");
CREATE INDEX "WorkflowTransitionDefinition_fromStateId_idx" ON "WorkflowTransitionDefinition"("fromStateId");
CREATE INDEX "WorkflowTransitionDefinition_toStateId_idx" ON "WorkflowTransitionDefinition"("toStateId");

ALTER TABLE "WorkflowTransitionDefinition"
  ADD CONSTRAINT "WorkflowTransitionDefinition_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowTransitionDefinition"
  ADD CONSTRAINT "WorkflowTransitionDefinition_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowTransitionDefinition"
  ADD CONSTRAINT "WorkflowTransitionDefinition_fromStateId_fkey"
  FOREIGN KEY ("fromStateId") REFERENCES "WorkflowStateDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowTransitionDefinition"
  ADD CONSTRAINT "WorkflowTransitionDefinition_toStateId_fkey"
  FOREIGN KEY ("toStateId") REFERENCES "WorkflowStateDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowInstance" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "tenantId" UUID NOT NULL,
  "definitionId" UUID NOT NULL,
  "currentStateId" UUID NOT NULL,
  "requestId" UUID,
  "publicRequestId" UUID,
  "municipalAssetId" UUID,
  "financeProcessId" UUID,
  CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowInstance_requestId_key" ON "WorkflowInstance"("requestId");
CREATE UNIQUE INDEX "WorkflowInstance_publicRequestId_key" ON "WorkflowInstance"("publicRequestId");
CREATE UNIQUE INDEX "WorkflowInstance_municipalAssetId_key" ON "WorkflowInstance"("municipalAssetId");
CREATE UNIQUE INDEX "WorkflowInstance_financeProcessId_key" ON "WorkflowInstance"("financeProcessId");
CREATE INDEX "WorkflowInstance_tenantId_idx" ON "WorkflowInstance"("tenantId");
CREATE INDEX "WorkflowInstance_definitionId_idx" ON "WorkflowInstance"("definitionId");
CREATE INDEX "WorkflowInstance_currentStateId_idx" ON "WorkflowInstance"("currentStateId");

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_currentStateId_fkey"
  FOREIGN KEY ("currentStateId") REFERENCES "WorkflowStateDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_publicRequestId_fkey"
  FOREIGN KEY ("publicRequestId") REFERENCES "PublicRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkflowEvent" (
  "id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "instanceId" UUID NOT NULL,
  "fromStateId" UUID,
  "toStateId" UUID NOT NULL,
  "actorUserId" UUID,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEvent_tenantId_idx" ON "WorkflowEvent"("tenantId");
CREATE INDEX "WorkflowEvent_instanceId_idx" ON "WorkflowEvent"("instanceId");
CREATE INDEX "WorkflowEvent_createdAt_idx" ON "WorkflowEvent"("createdAt");
CREATE INDEX "WorkflowEvent_actorUserId_idx" ON "WorkflowEvent"("actorUserId");

ALTER TABLE "WorkflowEvent"
  ADD CONSTRAINT "WorkflowEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
  ADD CONSTRAINT "WorkflowEvent_instanceId_fkey"
  FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
  ADD CONSTRAINT "WorkflowEvent_fromStateId_fkey"
  FOREIGN KEY ("fromStateId") REFERENCES "WorkflowStateDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
  ADD CONSTRAINT "WorkflowEvent_toStateId_fkey"
  FOREIGN KEY ("toStateId") REFERENCES "WorkflowStateDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
  ADD CONSTRAINT "WorkflowEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Assets
CREATE TABLE "MunicipalAsset" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "status" "MunicipalAssetStatus" NOT NULL DEFAULT 'REGISTERED',
  "location" TEXT,
  "notes" TEXT,
  "acquisitionDate" TIMESTAMP(3),
  "acquisitionValue" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "requestingServiceId" INTEGER,
  "requestId" UUID,
  "assignedToUserId" UUID,
  CONSTRAINT "MunicipalAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MunicipalAsset_tenantId_code_key" ON "MunicipalAsset"("tenantId", "code");
CREATE INDEX "MunicipalAsset_tenantId_idx" ON "MunicipalAsset"("tenantId");
CREATE INDEX "MunicipalAsset_status_idx" ON "MunicipalAsset"("status");
CREATE INDEX "MunicipalAsset_requestingServiceId_idx" ON "MunicipalAsset"("requestingServiceId");
CREATE INDEX "MunicipalAsset_requestId_idx" ON "MunicipalAsset"("requestId");
CREATE INDEX "MunicipalAsset_assignedToUserId_idx" ON "MunicipalAsset"("assignedToUserId");

ALTER TABLE "MunicipalAsset"
  ADD CONSTRAINT "MunicipalAsset_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAsset"
  ADD CONSTRAINT "MunicipalAsset_requestingServiceId_fkey"
  FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAsset"
  ADD CONSTRAINT "MunicipalAsset_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAsset"
  ADD CONSTRAINT "MunicipalAsset_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MunicipalAssetEvent" (
  "id" UUID NOT NULL,
  "fromStatus" "MunicipalAssetStatus",
  "toStatus" "MunicipalAssetStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "actorUserId" UUID,
  CONSTRAINT "MunicipalAssetEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MunicipalAssetEvent_tenantId_idx" ON "MunicipalAssetEvent"("tenantId");
CREATE INDEX "MunicipalAssetEvent_assetId_idx" ON "MunicipalAssetEvent"("assetId");
CREATE INDEX "MunicipalAssetEvent_createdAt_idx" ON "MunicipalAssetEvent"("createdAt");
CREATE INDEX "MunicipalAssetEvent_actorUserId_idx" ON "MunicipalAssetEvent"("actorUserId");

ALTER TABLE "MunicipalAssetEvent"
  ADD CONSTRAINT "MunicipalAssetEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetEvent"
  ADD CONSTRAINT "MunicipalAssetEvent_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MunicipalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetEvent"
  ADD CONSTRAINT "MunicipalAssetEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MunicipalAssetAssignment" (
  "id" UUID NOT NULL,
  "note" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "userId" UUID,
  "requestingServiceId" INTEGER,
  CONSTRAINT "MunicipalAssetAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MunicipalAssetAssignment_tenantId_idx" ON "MunicipalAssetAssignment"("tenantId");
CREATE INDEX "MunicipalAssetAssignment_assetId_idx" ON "MunicipalAssetAssignment"("assetId");
CREATE INDEX "MunicipalAssetAssignment_userId_idx" ON "MunicipalAssetAssignment"("userId");
CREATE INDEX "MunicipalAssetAssignment_requestingServiceId_idx" ON "MunicipalAssetAssignment"("requestingServiceId");
CREATE INDEX "MunicipalAssetAssignment_startAt_idx" ON "MunicipalAssetAssignment"("startAt");
CREATE INDEX "MunicipalAssetAssignment_endAt_idx" ON "MunicipalAssetAssignment"("endAt");

ALTER TABLE "MunicipalAssetAssignment"
  ADD CONSTRAINT "MunicipalAssetAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetAssignment"
  ADD CONSTRAINT "MunicipalAssetAssignment_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MunicipalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetAssignment"
  ADD CONSTRAINT "MunicipalAssetAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MunicipalAssetAssignment"
  ADD CONSTRAINT "MunicipalAssetAssignment_requestingServiceId_fkey"
  FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Finance
CREATE TABLE "FinanceProcess" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
  "budgetLine" TEXT,
  "note" TEXT,
  "status" "FinanceProcessStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "requestId" UUID,
  "requestingServiceId" INTEGER,
  CONSTRAINT "FinanceProcess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceProcess_tenantId_code_key" ON "FinanceProcess"("tenantId", "code");
CREATE INDEX "FinanceProcess_tenantId_idx" ON "FinanceProcess"("tenantId");
CREATE INDEX "FinanceProcess_status_idx" ON "FinanceProcess"("status");
CREATE INDEX "FinanceProcess_requestId_idx" ON "FinanceProcess"("requestId");
CREATE INDEX "FinanceProcess_requestingServiceId_idx" ON "FinanceProcess"("requestingServiceId");

ALTER TABLE "FinanceProcess"
  ADD CONSTRAINT "FinanceProcess_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceProcess"
  ADD CONSTRAINT "FinanceProcess_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceProcess"
  ADD CONSTRAINT "FinanceProcess_requestingServiceId_fkey"
  FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_municipalAssetId_fkey"
  FOREIGN KEY ("municipalAssetId") REFERENCES "MunicipalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowInstance"
  ADD CONSTRAINT "WorkflowInstance_financeProcessId_fkey"
  FOREIGN KEY ("financeProcessId") REFERENCES "FinanceProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceProcessEvent" (
  "id" UUID NOT NULL,
  "fromStatus" "FinanceProcessStatus",
  "toStatus" "FinanceProcessStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "financeProcessId" UUID NOT NULL,
  "actorUserId" UUID,
  CONSTRAINT "FinanceProcessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceProcessEvent_tenantId_idx" ON "FinanceProcessEvent"("tenantId");
CREATE INDEX "FinanceProcessEvent_financeProcessId_idx" ON "FinanceProcessEvent"("financeProcessId");
CREATE INDEX "FinanceProcessEvent_createdAt_idx" ON "FinanceProcessEvent"("createdAt");
CREATE INDEX "FinanceProcessEvent_actorUserId_idx" ON "FinanceProcessEvent"("actorUserId");

ALTER TABLE "FinanceProcessEvent"
  ADD CONSTRAINT "FinanceProcessEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceProcessEvent"
  ADD CONSTRAINT "FinanceProcessEvent_financeProcessId_fkey"
  FOREIGN KEY ("financeProcessId") REFERENCES "FinanceProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceProcessEvent"
  ADD CONSTRAINT "FinanceProcessEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Presidency dispatch
CREATE TABLE "PresidencyDispatch" (
  "id" UUID NOT NULL,
  "status" "PresidencyDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "decidedByUserId" UUID,
  CONSTRAINT "PresidencyDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PresidencyDispatch_requestId_key" ON "PresidencyDispatch"("requestId");
CREATE INDEX "PresidencyDispatch_tenantId_idx" ON "PresidencyDispatch"("tenantId");
CREATE INDEX "PresidencyDispatch_status_idx" ON "PresidencyDispatch"("status");
CREATE INDEX "PresidencyDispatch_decidedByUserId_idx" ON "PresidencyDispatch"("decidedByUserId");

ALTER TABLE "PresidencyDispatch"
  ADD CONSTRAINT "PresidencyDispatch_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PresidencyDispatch"
  ADD CONSTRAINT "PresidencyDispatch_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PresidencyDispatch"
  ADD CONSTRAINT "PresidencyDispatch_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
