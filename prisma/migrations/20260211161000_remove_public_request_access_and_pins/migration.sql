-- Remove deprecated public link and PIN infrastructure.
ALTER TABLE "PublicRequest" DROP CONSTRAINT IF EXISTS "PublicRequest_accessId_fkey";
DROP INDEX IF EXISTS "PublicRequest_accessId_idx";
ALTER TABLE "PublicRequest" DROP COLUMN IF EXISTS "accessId";

DROP TABLE IF EXISTS "PublicRequestPin";
DROP TABLE IF EXISTS "PublicRequestAccess";
