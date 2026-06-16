-- Per-org API key overrides for enterprise BYOK (Sprint 7).
-- The keyEncrypted column stores the key as-supplied; a future
-- iteration will wrap this with a KMS-backed envelope.
CREATE TABLE IF NOT EXISTS org_api_keys (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  provider      TEXT NOT NULL,
  key_encrypted TEXT NOT NULL,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT org_provider_unique UNIQUE (org_id, provider)
);
