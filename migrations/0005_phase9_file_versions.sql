-- migrations/0005_phase9_file_versions.sql
-- Phase 9: Digital Material Versioning, Safe Replacement, Entitlement Continuity

-- 1. Digital File Versions Table
--    Maintains immutable historical records of every digital asset version.
--    Products and add-ons reference their current active file version without altering IDs or historical orders.
CREATE TABLE IF NOT EXISTS digital_file_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  add_on_id TEXT,
  version_label TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  release_notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'ARCHIVED'
  created_at TEXT NOT NULL,
  archived_at TEXT,
  created_by TEXT
);

-- 2. Fast targeted indexes for single-query version lookups on Cloudflare Free plan
CREATE INDEX IF NOT EXISTS idx_dfv_product_lookup ON digital_file_versions(product_id, status);
CREATE INDEX IF NOT EXISTS idx_dfv_product_addon_lookup ON digital_file_versions(product_id, add_on_id, status);
CREATE INDEX IF NOT EXISTS idx_dfv_created_at ON digital_file_versions(created_at DESC);
