DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestType') THEN
    CREATE TYPE "RequestType" AS ENUM ('STANDARD', 'RETURN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestItemRole') THEN
    CREATE TYPE "RequestItemRole" AS ENUM ('NORMAL', 'OLD', 'NEW');
  END IF;
END $$;

ALTER TABLE "Request"
  ADD COLUMN IF NOT EXISTS "requestType" "RequestType" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "RequestItem"
  ADD COLUMN IF NOT EXISTS "role" "RequestItemRole" NOT NULL DEFAULT 'NORMAL';

UPDATE "Request"
SET "requestType" = 'RETURN'
WHERE "requestType" = 'STANDARD'
  AND (
    COALESCE("title", '') ILIKE '[DEVOLUÇÃO]%'
    OR COALESCE("notes", '') ILIKE '%Tipo: DEVOLUÇÃO/SUBSTITUIÇÃO%'
  );

UPDATE "RequestItem"
SET "role" = 'OLD'
WHERE "role" = 'NORMAL'
  AND (
    COALESCE("reference", '') ILIKE '%[ANTIGO]%'
    OR COALESCE("notes", '') ILIKE '%[ANTIGO]%'
  );

UPDATE "RequestItem"
SET "role" = 'NEW'
WHERE "role" = 'NORMAL'
  AND (
    COALESCE("reference", '') ILIKE '%[NOVO]%'
    OR COALESCE("notes", '') ILIKE '%[NOVO]%'
  );
