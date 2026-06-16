-- CreateTable
CREATE TABLE "api_usage_log" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failure_code" TEXT,
    "called_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_usage_log_project_id_called_at_idx" ON "api_usage_log"("project_id", "called_at");

-- CreateIndex
CREATE INDEX "api_usage_log_user_id_called_at_idx" ON "api_usage_log"("user_id", "called_at");
