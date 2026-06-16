-- CreateTable
CREATE TABLE "activity_relationships" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "successor_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "constraint_type" TEXT NOT NULL DEFAULT 'hard',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_relationships_predecessor_id_successor_id_relation_key" ON "activity_relationships"("predecessor_id", "successor_id", "relationship_type");

-- AddForeignKey
ALTER TABLE "activity_relationships" ADD CONSTRAINT "activity_relationships_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_relationships" ADD CONSTRAINT "activity_relationships_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "schedule_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_relationships" ADD CONSTRAINT "activity_relationships_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "schedule_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
