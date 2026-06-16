-- CreateTable
CREATE TABLE "equipment_status_log" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "logged_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_status_log_equipment_id_date_idx" ON "equipment_status_log"("equipment_id", "date");

-- AddForeignKey
ALTER TABLE "equipment_status_log" ADD CONSTRAINT "equipment_status_log_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
