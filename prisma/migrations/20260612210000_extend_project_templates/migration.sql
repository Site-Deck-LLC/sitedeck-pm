-- Extend project_templates with full project snapshot fields.
-- Older templates (created in Sprint 6) have nulls and continue to work
-- as WBS-only templates via the existing applyTemplate() path.
ALTER TABLE project_templates
  ADD COLUMN IF NOT EXISTS activities_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS budget_snapshot     JSONB,
  ADD COLUMN IF NOT EXISTS risks_snapshot      JSONB,
  ADD COLUMN IF NOT EXISTS lessons_snapshot    JSONB;
