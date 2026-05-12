CREATE TABLE "Employee" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(255),
  "phoneOrExtension" VARCHAR(60),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "requestingServiceId" INTEGER NOT NULL,

  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_tenantId_requestingServiceId_name_key"
  ON "Employee"("tenantId", "requestingServiceId", "name");

CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");
CREATE INDEX "Employee_requestingServiceId_idx" ON "Employee"("requestingServiceId");
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_requestingServiceId_fkey"
  FOREIGN KEY ("requestingServiceId") REFERENCES "servicos_requisitantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
