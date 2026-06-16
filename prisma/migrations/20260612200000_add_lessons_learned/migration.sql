-- Real-time lessons-learned capture. Lessons surface both as agent
-- flags (auto-detected from project patterns) and PM-entered manual
-- entries. `added_to_template` controls which lessons ride along when
-- the project is saved as a template.

CREATE TABLE "lessons_learned" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "impact" TEXT,
    "recommendation" TEXT,
    "dfow_ref" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "added_to_template" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "lessons_learned_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lessons_learned_project_id_category_idx" ON "lessons_learned"("project_id", "category");
CREATE INDEX "lessons_learned_project_id_source_idx" ON "lessons_learned"("project_id", "source");
CREATE INDEX "lessons_learned_project_id_added_to_template_idx" ON "lessons_learned"("project_id", "added_to_template");

ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
