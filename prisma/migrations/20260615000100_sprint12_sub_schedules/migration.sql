-- Sprint 12 Task 6: Sub-schedule hierarchy
-- SubSchedule is owned by a subcontract. SubScheduleActivity is a
-- child task that can link to a master ScheduleActivity for rollup.

CREATE TABLE IF NOT EXISTS "sub_schedules" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subcontract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseline_start_date" TIMESTAMP(3),
    "baseline_end_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sub_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sub_schedules_project_id_idx" ON "sub_schedules"("project_id");
CREATE INDEX IF NOT EXISTS "sub_schedules_subcontract_id_idx" ON "sub_schedules"("subcontract_id");

CREATE TABLE IF NOT EXISTS "sub_schedule_activities" (
    "id" TEXT NOT NULL,
    "sub_schedule_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "percent_complete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "linked_master_activity_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sub_schedule_activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sub_schedule_activities_sub_schedule_id_fkey" FOREIGN KEY ("sub_schedule_id") REFERENCES "sub_schedules"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sub_schedule_activities_sub_schedule_id_idx" ON "sub_schedule_activities"("sub_schedule_id");
CREATE INDEX IF NOT EXISTS "sub_schedule_activities_linked_master_activity_id_idx" ON "sub_schedule_activities"("linked_master_activity_id");
