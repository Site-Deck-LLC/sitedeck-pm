-- Audit log for document downloads. One row per presigned-GET issuance
-- (records intent to access, not the actual GET).
CREATE TABLE "document_download_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "revision_id" TEXT,
    "user_id" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "document_download_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_download_logs_document_id_idx" ON "document_download_logs"("document_id");
CREATE INDEX "document_download_logs_user_id_idx" ON "document_download_logs"("user_id");
