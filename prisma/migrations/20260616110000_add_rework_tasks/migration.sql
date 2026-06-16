-- CreateTable
CREATE TABLE "rework_tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "dfow_id" TEXT,
    "inspection_record_id" TEXT,
    "ncr_id" TEXT,
    "source" TEXT NOT NULL,
    "source_event_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rework_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rework_tasks_project_id_status_idx" ON "rework_tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "rework_tasks_project_id_source_idx" ON "rework_tasks"("project_id", "source");

-- AddForeignKey
ALTER TABLE "rework_tasks" ADD CONSTRAINT "rework_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
