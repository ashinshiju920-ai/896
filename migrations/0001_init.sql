-- migrations/0001_init.sql
-- Cloudflare D1 Schema for E-Commerce Hardening (Phase 4)
-- Money is strictly stored as INTEGER paise, never floating point.

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  cf_order_id TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_json TEXT,
  items_json TEXT,
  meta_context_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  raw_payload TEXT,
  created_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_orders_cf_order_id ON orders(cf_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_meta_purchase_status_next ON meta_purchase_events(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_meta_purchase_updated ON meta_purchase_events(updated_at DESC);
