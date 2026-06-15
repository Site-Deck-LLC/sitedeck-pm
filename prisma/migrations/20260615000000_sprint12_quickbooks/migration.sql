-- Sprint 12 Task 5: QuickBooks integration tables
-- PM only exports to QBO. One token row per linked realm (one QBO
-- company). One export row per change order (unique by projectId
-- + changeOrderId to keep exports idempotent).

CREATE TABLE IF NOT EXISTS "quickbooks_tokens" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quickbooks_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_tokens_realm_id_key" ON "quickbooks_tokens"("realm_id");

CREATE TABLE IF NOT EXISTS "quickbooks_exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "change_order_id" TEXT NOT NULL,
    "qbo_invoice_id" TEXT NOT NULL,
    "qbo_invoice_number" TEXT,
    "qbo_customer_id" TEXT,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exported_by" TEXT NOT NULL,
    CONSTRAINT "quickbooks_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_exports_project_id_change_order_id_key" ON "quickbooks_exports"("project_id", "change_order_id");
CREATE INDEX IF NOT EXISTS "quickbooks_exports_project_id_idx" ON "quickbooks_exports"("project_id");
