-- RBAC foundation (roles, permissions, scoped assignments)
CREATE TABLE "AccessPermission" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  CONSTRAINT "AccessPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessRole" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessRolePermission" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  CONSTRAINT "AccessRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleAssignment" (
  "id" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "requestingServiceId" INTEGER,
  "assignedByUserId" UUID,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessPermission_tenantId_key_key" ON "AccessPermission"("tenantId", "key");
CREATE UNIQUE INDEX "AccessRole_tenantId_key_key" ON "AccessRole"("tenantId", "key");
CREATE UNIQUE INDEX "AccessRolePermission_roleId_permissionId_key" ON "AccessRolePermission"("roleId", "permissionId");

CREATE INDEX "AccessPermission_tenantId_idx" ON "AccessPermission"("tenantId");
CREATE INDEX "AccessRole_tenantId_idx" ON "AccessRole"("tenantId");
CREATE INDEX "AccessRolePermission_tenantId_idx" ON "AccessRolePermission"("tenantId");
CREATE INDEX "AccessRolePermission_roleId_idx" ON "AccessRolePermission"("roleId");
CREATE INDEX "AccessRolePermission_permissionId_idx" ON "AccessRolePermission"("permissionId");

CREATE INDEX "UserRoleAssignment_tenantId_idx" ON "UserRoleAssignment"("tenantId");
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");
CREATE INDEX "UserRoleAssignment_requestingServiceId_idx" ON "UserRoleAssignment"("requestingServiceId");
CREATE INDEX "UserRoleAssignment_isActive_idx" ON "UserRoleAssignment"("isActive");
CREATE INDEX "UserRoleAssignment_startsAt_idx" ON "UserRoleAssignment"("startsAt");
CREATE INDEX "UserRoleAssignment_endsAt_idx" ON "UserRoleAssignment"("endsAt");

ALTER TABLE "AccessPermission"
  ADD CONSTRAINT "AccessPermission_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRole"
  ADD CONSTRAINT "AccessRole_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRolePermission"
  ADD CONSTRAINT "AccessRolePermission_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRolePermission"
  ADD CONSTRAINT "AccessRolePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessRolePermission"
  ADD CONSTRAINT "AccessRolePermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "AccessPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_requestingServiceId_fkey"
  FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
