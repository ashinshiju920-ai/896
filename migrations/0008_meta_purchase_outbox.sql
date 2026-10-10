-- Durable Meta Purchase delivery state.
-- One logical Meta Purchase event per verified paid order.

CREATE TABLE IF NOT EXISTS meta_purchase_events (
  order_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  value_paise INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  last_source TEXT,
  last_error TEXT,
  next_attempt_at TEXT,
  processing_started_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meta_purchase_status_next ON meta_purchase_events(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_meta_purchase_updated ON meta_purchase_events(updated_at DESC);
