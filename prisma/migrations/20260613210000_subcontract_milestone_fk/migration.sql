-- Sprint 9 Task 9: Subcontract milestone FK to subcontract
-- The table was added in 20260613200000_sprint9_schema without a
-- FK constraint so it could be created against the live DB without
-- a parent back-relation. Now that the Prisma schema declares the
-- back-relation, add the FK so ON DELETE CASCADE works.

ALTER TABLE subcontract_milestones
  ADD CONSTRAINT subcontract_milestones_subcontract_id_fkey
  FOREIGN KEY (subcontract_id) REFERENCES subcontracts(id) ON DELETE CASCADE;
