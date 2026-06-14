-- Sprint 11 Task 7: CompoundRisk history table
CREATE TABLE IF NOT EXISTS "compound_risks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rule_triggered" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "linked_items" JSONB,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution" TEXT,
    CONSTRAINT "compound_risks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "compound_risks_project_id_detected_at_idx" ON "compound_risks"("project_id", "detected_at");
CREATE INDEX IF NOT EXISTS "compound_risks_resolved_at_idx" ON "compound_risks"("resolved_at");
