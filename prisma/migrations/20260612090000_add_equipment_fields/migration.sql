-- AlterTable
ALTER TABLE "equipment" ADD COLUMN "is_owned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "equipment" ADD COLUMN "serial_number" TEXT;
ALTER TABLE "equipment" ADD COLUMN "vendor" TEXT;
ALTER TABLE "equipment" ADD COLUMN "cal_due_date" DATE;
