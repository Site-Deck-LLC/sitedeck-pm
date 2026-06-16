-- Sprint 9 schema additions

-- Document IFC tracking fields
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS current_revision_id TEXT,
  ADD COLUMN IF NOT EXISTS ifc_released_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ifc_released_by     TEXT;
-- All additive changes (no destructive) so the migration is forward-compatible
-- with any data already in the live DB.

-- ─── Task 1: IFC propagation
-- DrawingAuditLog — records lifecycle events on a document (IFC release, etc.)
CREATE TABLE IF NOT EXISTS drawing_audit_log (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  document_id TEXT NOT NULL,
  event_type  TEXT NOT NULL,  -- 'drawing_released_ifc', etc.
  actor_id    TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS drawing_audit_log_project_idx ON drawing_audit_log (project_id);
CREATE INDEX IF NOT EXISTS drawing_audit_log_document_idx ON drawing_audit_log (document_id);

-- ─── Task 2: Field redlines
CREATE TABLE IF NOT EXISTS drawing_redlines (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  document_id       TEXT NOT NULL,
  revision_id       TEXT,
  submitted_by      TEXT NOT NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description       TEXT NOT NULL,
  redline_type      TEXT NOT NULL,  -- conflict | clarification | as_built_deviation | field_decision | rfi_required
  photo_url         TEXT,
  linked_rfi_id     TEXT,
  linked_activity_id TEXT,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | reviewed | escalated_to_rfi | accepted_field_decision | incorporated
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS drawing_redlines_project_idx ON drawing_redlines (project_id);
CREATE INDEX IF NOT EXISTS drawing_redlines_document_idx ON drawing_redlines (document_id);
CREATE INDEX IF NOT EXISTS drawing_redlines_status_idx ON drawing_redlines (status);

-- ─── Task 3: FCM push tokens
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,  -- web | ios | android
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_platform_idx ON fcm_tokens (user_id, platform);
CREATE INDEX IF NOT EXISTS fcm_tokens_user_idx ON fcm_tokens (user_id);

-- ─── Task 6: Team management
CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,  -- contractor | owner | sub
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  email        TEXT NOT NULL,
  display_name TEXT,
  role         TEXT NOT NULL,
  invited_by   TEXT,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at    TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'invited'  -- invited | active | inactive
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_unique_idx ON organization_members (org_id, user_id);
CREATE INDEX IF NOT EXISTS organization_members_org_idx ON organization_members (org_id);

CREATE TABLE IF NOT EXISTS project_members (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  email        TEXT NOT NULL,
  display_name TEXT,
  role         TEXT NOT NULL,
  added_by     TEXT NOT NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'invited'  -- invited | active | inactive
);
CREATE UNIQUE INDEX IF NOT EXISTS project_members_unique_idx ON project_members (project_id, user_id);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members (project_id);

-- ─── Task 9: Subcontract milestones
CREATE TABLE IF NOT EXISTS subcontract_milestones (
  id                  TEXT PRIMARY KEY,
  subcontract_id      TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  planned_date        TIMESTAMPTZ NOT NULL,
  actual_date         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | met | missed | waived
  linked_activity_id  TEXT,
  billing_trigger     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subcontract_milestones_sub_idx ON subcontract_milestones (subcontract_id);
CREATE INDEX IF NOT EXISTS subcontract_milestones_status_idx ON subcontract_milestones (status);
