-- OwnerReport table: persisted weekly owner reports.
-- Idempotent re-apply: unique (project_id, week_ending) so the same week
-- is never stored twice for a given project. UI updates via PUT to the
-- existing row rather than INSERT-OR-UPDATE dance.

CREATE TABLE "owner_reports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "week_ending" TIMESTAMP(3) NOT NULL,
    "report_json" JSONB NOT NULL,
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "sent_to_email" TEXT,
    CONSTRAINT "owner_reports_pkey" PRIMARY KEY ("id")
);

-- One report per project per week
CREATE UNIQUE INDEX "owner_reports_project_id_week_ending_key" ON "owner_reports"("project_id", "week_ending");
CREATE INDEX "owner_reports_project_id_week_ending_idx" ON "owner_reports"("project_id", "week_ending");

-- FK to projects
ALTER TABLE "owner_reports" ADD CONSTRAINT "owner_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
