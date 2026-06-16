-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "trir_target" DOUBLE PRECISION DEFAULT 3.0;

-- AlterTable
ALTER TABLE "risk_items" ADD COLUMN     "recordable" BOOLEAN NOT NULL DEFAULT false;
