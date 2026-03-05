-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductUnitStatus" ADD VALUE 'IN_REPAIR';
ALTER TYPE "ProductUnitStatus" ADD VALUE 'SCRAPPED';
ALTER TYPE "ProductUnitStatus" ADD VALUE 'LOST';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'RETURN';
ALTER TYPE "StockMovementType" ADD VALUE 'REPAIR_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'REPAIR_IN';
ALTER TYPE "StockMovementType" ADD VALUE 'SCRAP';
ALTER TYPE "StockMovementType" ADD VALUE 'LOST';
