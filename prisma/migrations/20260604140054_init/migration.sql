-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "org_id" TEXT NOT NULL,
    "structure_type" TEXT NOT NULL,
    "structure_locked" BOOLEAN NOT NULL DEFAULT false,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "active_milestones" JSONB,
    "superintendent_assignments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_breakdown_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "structure_type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_breakdown_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_cost_code_crosswalk" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "gc_item_id" TEXT NOT NULL,
    "sub_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbs_cost_code_crosswalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_activities" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "wbs_item_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "percent_complete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "is_milestone" BOOLEAN NOT NULL DEFAULT false,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "total_float" DOUBLE PRECISION,
    "free_float" DOUBLE PRECISION,
    "early_start" TIMESTAMP(3),
    "early_finish" TIMESTAMP(3),
    "late_start" TIMESTAMP(3),
    "late_finish" TIMESTAMP(3),
    "predecessors" JSONB,
    "successors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_baselines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "baseline_date" TIMESTAMP(3) NOT NULL,
    "activities" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_change_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "proposed_start" TIMESTAMP(3),
    "proposed_end" TIMESTAMP(3),
    "impact_description" TEXT,
    "critical_path_impact" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decision_notes" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks_log" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "wbs_item_id" TEXT,
    "cost_code" TEXT,
    "name" TEXT NOT NULL,
    "budget_amount" DECIMAL(15,2) NOT NULL,
    "committed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "incurred_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "forecast_amount" DECIMAL(15,2),
    "percent_complete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance_threshold" DOUBLE PRECISION,
    "variance_flag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_transactions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "budget_line_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(15,2) NOT NULL,
    "wbs_item_id" TEXT,
    "activity_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_line_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL,
    "line_total" DECIMAL(15,2) NOT NULL,
    "quantity_received" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_deliveries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "line_item_id" TEXT NOT NULL,
    "quantity_received" DECIMAL(12,4) NOT NULL,
    "received_by" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "discrepancies" TEXT,
    "delivery_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_amount" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "match_status" TEXT,
    "match_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontracts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subcontractor_name" TEXT NOT NULL,
    "contract_amount" DECIMAL(15,2) NOT NULL,
    "schedule_of_values" JSONB,
    "retention_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_statements" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_orders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "co_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dollar_value" DECIMAL(15,2),
    "schedule_impact" DOUBLE PRECISION,
    "approver" TEXT,
    "approved_at" TIMESTAMP(3),
    "affected_activity_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "rfi_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "assigned_to" TEXT,
    "response_text" TEXT,
    "answered_at" TIMESTAMP(3),
    "hold_on_activity_id" TEXT,
    "source_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "submittal_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "spec_section" TEXT,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "hold_on_activity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "probability" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "mitigation_plan" TEXT,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "linked_activity_id" TEXT,
    "linked_budget_line_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "incident_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "activity_id" TEXT,
    "assignee" TEXT,
    "due_date" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_memos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "audio_url" TEXT NOT NULL,
    "transcription" TEXT NOT NULL,
    "structured_data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unified_change_log" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affected_record_id" TEXT,
    "affected_record_type" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unified_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closeout_checklists" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closeout_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_activity_id" TEXT,
    "last_usage_date" TIMESTAMP(3),
    "total_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_project_id_external_id_key" ON "equipment"("project_id", "external_id");

-- AddForeignKey
ALTER TABLE "work_breakdown_items" ADD CONSTRAINT "work_breakdown_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_activities" ADD CONSTRAINT "schedule_activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_transactions" ADD CONSTRAINT "cost_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_transactions" ADD CONSTRAINT "cost_transactions_budget_line_id_fkey" FOREIGN KEY ("budget_line_id") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deliveries" ADD CONSTRAINT "material_deliveries_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "po_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_statements" ADD CONSTRAINT "scope_statements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_memos" ADD CONSTRAINT "voice_memos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unified_change_log" ADD CONSTRAINT "unified_change_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closeout_checklists" ADD CONSTRAINT "closeout_checklists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
