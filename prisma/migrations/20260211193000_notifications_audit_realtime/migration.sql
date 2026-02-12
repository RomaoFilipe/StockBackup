CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "NotificationKind" AS ENUM (
  'REQUEST_CREATED',
  'REQUEST_STATUS_CHANGED',
  'REQUEST_UPDATED',
  'PUBLIC_REQUEST_RECEIVED',
  'PUBLIC_REQUEST_ACCEPTED',
  'PUBLIC_REQUEST_REJECTED'
);

ALTER TABLE "Request"
ADD COLUMN "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "dueAt" TIMESTAMP(3);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "tenantId" UUID NOT NULL,
  "recipientRole" "UserRole",
  "recipientUserId" UUID,
  "requestId" UUID,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequestStatusAudit" (
  "id" UUID NOT NULL,
  "fromStatus" "RequestStatus",
  "toStatus" "RequestStatus" NOT NULL,
  "note" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "changedByUserId" UUID,
  CONSTRAINT "RequestStatusAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Request_priority_idx" ON "Request"("priority");
CREATE INDEX "Request_dueAt_idx" ON "Request"("dueAt");

CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX "Notification_recipientRole_idx" ON "Notification"("recipientRole");
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");
CREATE INDEX "Notification_requestId_idx" ON "Notification"("requestId");

CREATE INDEX "RequestStatusAudit_tenantId_idx" ON "RequestStatusAudit"("tenantId");
CREATE INDEX "RequestStatusAudit_requestId_idx" ON "RequestStatusAudit"("requestId");
CREATE INDEX "RequestStatusAudit_createdAt_idx" ON "RequestStatusAudit"("createdAt");
CREATE INDEX "RequestStatusAudit_toStatus_idx" ON "RequestStatusAudit"("toStatus");
CREATE INDEX "RequestStatusAudit_changedByUserId_idx" ON "RequestStatusAudit"("changedByUserId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "Request"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestStatusAudit"
ADD CONSTRAINT "RequestStatusAudit_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestStatusAudit"
ADD CONSTRAINT "RequestStatusAudit_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "Request"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestStatusAudit"
ADD CONSTRAINT "RequestStatusAudit_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
