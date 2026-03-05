ALTER TABLE "AllowedIp"
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "AllowedIp_expiresAt_idx" ON "AllowedIp"("expiresAt");

CREATE TABLE "UserAdminAudit" (
  "id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "targetType" VARCHAR(40) NOT NULL DEFAULT 'USER',
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "actorUserId" UUID,
  "targetUserId" UUID,
  CONSTRAINT "UserAdminAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAdminAudit_tenantId_idx" ON "UserAdminAudit"("tenantId");
CREATE INDEX "UserAdminAudit_createdAt_idx" ON "UserAdminAudit"("createdAt");
CREATE INDEX "UserAdminAudit_action_idx" ON "UserAdminAudit"("action");
CREATE INDEX "UserAdminAudit_actorUserId_idx" ON "UserAdminAudit"("actorUserId");
CREATE INDEX "UserAdminAudit_targetUserId_idx" ON "UserAdminAudit"("targetUserId");

ALTER TABLE "UserAdminAudit"
ADD CONSTRAINT "UserAdminAudit_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAdminAudit"
ADD CONSTRAINT "UserAdminAudit_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserAdminAudit"
ADD CONSTRAINT "UserAdminAudit_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
