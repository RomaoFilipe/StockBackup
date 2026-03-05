CREATE TABLE IF NOT EXISTS "AuthLockout" (
  "key" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "failureCount" INTEGER NOT NULL,
  "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  CONSTRAINT "AuthLockout_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "AuthLockout_tenantId_idx" ON "AuthLockout"("tenantId");
CREATE INDEX IF NOT EXISTS "AuthLockout_email_idx" ON "AuthLockout"("email");
CREATE INDEX IF NOT EXISTS "AuthLockout_lockedUntil_idx" ON "AuthLockout"("lockedUntil");
