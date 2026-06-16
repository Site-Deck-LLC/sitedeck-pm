-- Sprint 7: Drawing Repository (Document + DocumentRevision).
-- Documents are logical drawings; revisions are versions. R2 holds the
-- bytes, this table holds the metadata.
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  discipline  TEXT NOT NULL,
  drawing_no  TEXT,
  status      TEXT NOT NULL DEFAULT 'current',
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents(project_id);
CREATE INDEX IF NOT EXISTS documents_project_status_idx ON documents(project_id, status);

CREATE TABLE IF NOT EXISTS document_revisions (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_no     INTEGER NOT NULL,
  storage_key     TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  sha256          TEXT,
  uploaded_by     TEXT NOT NULL,
  uploaded_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes           TEXT,
  upload_status   TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT document_revisions_doc_rev_unique UNIQUE (document_id, revision_no)
);
CREATE INDEX IF NOT EXISTS document_revisions_doc_id_idx ON document_revisions(document_id);
