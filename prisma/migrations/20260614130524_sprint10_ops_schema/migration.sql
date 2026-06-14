-- DropForeignKey
ALTER TABLE "document_revisions" DROP CONSTRAINT "document_revisions_document_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_fkey";

-- DropForeignKey
ALTER TABLE "lessons_learned" DROP CONSTRAINT "lessons_learned_project_id_fkey";

-- DropForeignKey
ALTER TABLE "owner_reports" DROP CONSTRAINT "owner_reports_project_id_fkey";

-- DropForeignKey
ALTER TABLE "subcontract_milestones" DROP CONSTRAINT "subcontract_milestones_subcontract_id_fkey";

-- DropIndex
DROP INDEX "notifications_user_id_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_read_created_at_idx";

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "ifc_released_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "drawing_audit_log" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "drawing_redlines" ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reviewed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "fcm_tokens" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "org_api_keys" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "invited_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "joined_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project_members" ALTER COLUMN "added_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subcontract_milestones" ALTER COLUMN "planned_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "actual_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "route" TEXT NOT NULL,
    "page_title" TEXT NOT NULL,
    "console_errors" JSONB,
    "last_api_call" JSONB,
    "user_action" TEXT NOT NULL,
    "browser_info" JSONB,
    "classification" TEXT,
    "classification_confidence" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'new',
    "blast_radius" JSONB,
    "suggested_fix" TEXT,
    "risk_level" TEXT,
    "workaround" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_requests" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "route" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_approval_tokens" (
    "id" TEXT NOT NULL,
    "bug_report_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "reject_reason" TEXT,

    CONSTRAINT "bug_approval_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_audit_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_status_created_at_idx" ON "bug_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "bug_reports_product_status_idx" ON "bug_reports"("product", "status");

-- CreateIndex
CREATE INDEX "bug_reports_user_id_idx" ON "bug_reports"("user_id");

-- CreateIndex
CREATE INDEX "feature_requests_product_status_idx" ON "feature_requests"("product", "status");

-- CreateIndex
CREATE INDEX "feature_requests_request_count_idx" ON "feature_requests"("request_count");

-- CreateIndex
CREATE UNIQUE INDEX "bug_approval_tokens_bug_report_id_key" ON "bug_approval_tokens"("bug_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "bug_approval_tokens_token_key" ON "bug_approval_tokens"("token");

-- CreateIndex
CREATE INDEX "bug_approval_tokens_token_idx" ON "bug_approval_tokens"("token");

-- CreateIndex
CREATE INDEX "bug_approval_tokens_expires_at_idx" ON "bug_approval_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "ops_audit_log_created_at_idx" ON "ops_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "ops_audit_log_action_created_at_idx" ON "ops_audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "ops_audit_log_target_type_target_id_idx" ON "ops_audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_reports" ADD CONSTRAINT "owner_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontract_milestones" ADD CONSTRAINT "subcontract_milestones_subcontract_id_fkey" FOREIGN KEY ("subcontract_id") REFERENCES "subcontracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_approval_tokens" ADD CONSTRAINT "bug_approval_tokens_bug_report_id_fkey" FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "document_revisions_doc_id_idx" RENAME TO "document_revisions_document_id_idx";

-- RenameIndex
ALTER INDEX "document_revisions_doc_rev_unique" RENAME TO "document_revisions_document_id_revision_no_key";

-- RenameIndex
ALTER INDEX "documents_project_status_idx" RENAME TO "documents_project_id_status_idx";

-- RenameIndex
ALTER INDEX "drawing_audit_log_document_idx" RENAME TO "drawing_audit_log_document_id_idx";

-- RenameIndex
ALTER INDEX "drawing_audit_log_project_idx" RENAME TO "drawing_audit_log_project_id_idx";

-- RenameIndex
ALTER INDEX "drawing_redlines_document_idx" RENAME TO "drawing_redlines_document_id_idx";

-- RenameIndex
ALTER INDEX "drawing_redlines_project_idx" RENAME TO "drawing_redlines_project_id_idx";

-- RenameIndex
ALTER INDEX "fcm_tokens_user_idx" RENAME TO "fcm_tokens_user_id_idx";

-- RenameIndex
ALTER INDEX "fcm_tokens_user_platform_idx" RENAME TO "fcm_tokens_user_id_platform_key";

-- RenameIndex
ALTER INDEX "org_provider_unique" RENAME TO "org_api_keys_org_id_provider_key";

-- RenameIndex
ALTER INDEX "organization_members_org_idx" RENAME TO "organization_members_org_id_idx";

-- RenameIndex
ALTER INDEX "organization_members_unique_idx" RENAME TO "organization_members_org_id_user_id_key";

-- RenameIndex
ALTER INDEX "project_members_project_idx" RENAME TO "project_members_project_id_idx";

-- RenameIndex
ALTER INDEX "project_members_unique_idx" RENAME TO "project_members_project_id_user_id_key";

-- RenameIndex
ALTER INDEX "subcontract_milestones_sub_idx" RENAME TO "subcontract_milestones_subcontract_id_idx";
