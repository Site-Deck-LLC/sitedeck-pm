-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "absent_count" INTEGER,
ADD COLUMN     "affected_activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "late_count" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "present_count" INTEGER;
