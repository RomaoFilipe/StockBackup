CREATE INDEX IF NOT EXISTS "User_tenantId_createdAt_idx" ON "User"("tenantId", "createdAt" DESC);
