/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,gtmiNumber]` on the table `Request` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,gtmiYear,gtmiSeq]` on the table `Request` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IpAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProductInvoice" DROP CONSTRAINT "ProductInvoice_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProductUnit" DROP CONSTRAINT "ProductUnit_userId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_userId_fkey";

-- DropForeignKey
ALTER TABLE "StoredFile" DROP CONSTRAINT "StoredFile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_userId_fkey";

-- DropIndex
DROP INDEX "Request_userId_gtmiNumber_key";

-- DropIndex
DROP INDEX "Request_userId_gtmiYear_gtmiSeq_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdByUserId" UUID,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tenantId" UUID;

-- Backfill tenants.
-- Create one tenant per existing user id so existing rows that used to point to User(id)
-- can now point to Tenant(id) without rewriting all tenant-owned tables.
WITH users AS (
    SELECT
        "id",
        "name",
        "email",
        row_number() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rn
    FROM "User"
)
INSERT INTO "Tenant" ("id", "slug", "name")
SELECT
    "id",
    CASE
        WHEN rn = 1 THEN 'default'
        ELSE 'tenant-' || substring(replace("id"::text, '-', '') from 1 for 12)
    END,
    COALESCE(NULLIF("name", ''), 'Tenant')
FROM users;

-- If there were no users (fresh DB), create a default tenant with a deterministic UUID.
INSERT INTO "Tenant" ("id", "slug", "name")
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'default', 'Default Tenant'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant");

-- Backfill tenantId columns.
UPDATE "User" SET "tenantId" = "id" WHERE "tenantId" IS NULL;
UPDATE "Request" SET "tenantId" = "userId" WHERE "tenantId" IS NULL;

-- Enforce NOT NULL now that existing rows are backfilled.
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "AllowedIp" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ipOrCidr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID,

    CONSTRAINT "AllowedIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAccessRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "status" "IpAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "note" TEXT,

    CONSTRAINT "IpAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "AllowedIp_tenantId_idx" ON "AllowedIp"("tenantId");

-- CreateIndex
CREATE INDEX "AllowedIp_isActive_idx" ON "AllowedIp"("isActive");

-- CreateIndex
CREATE INDEX "IpAccessRequest_tenantId_idx" ON "IpAccessRequest"("tenantId");

-- CreateIndex
CREATE INDEX "IpAccessRequest_status_idx" ON "IpAccessRequest"("status");

-- CreateIndex
CREATE INDEX "IpAccessRequest_createdAt_idx" ON "IpAccessRequest"("createdAt");

-- CreateIndex
CREATE INDEX "IpAccessRequest_reviewedAt_idx" ON "IpAccessRequest"("reviewedAt");

-- CreateIndex
CREATE INDEX "Request_tenantId_idx" ON "Request"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_tenantId_gtmiNumber_key" ON "Request"("tenantId", "gtmiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Request_tenantId_gtmiYear_gtmiSeq_key" ON "Request"("tenantId", "gtmiYear", "gtmiSeq");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInvoice" ADD CONSTRAINT "ProductInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowedIp" ADD CONSTRAINT "AllowedIp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowedIp" ADD CONSTRAINT "AllowedIp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAccessRequest" ADD CONSTRAINT "IpAccessRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAccessRequest" ADD CONSTRAINT "IpAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAccessRequest" ADD CONSTRAINT "IpAccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
