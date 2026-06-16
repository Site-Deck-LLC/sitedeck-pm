-- Sprint 13: Link schedule activities to Benchmark DFOWs
-- Enables bidirectional PM ↔ Benchmark inspection sync

ALTER TABLE "schedule_activities"
ADD COLUMN IF NOT EXISTS "linked_benchmark_dfow_id" TEXT;
