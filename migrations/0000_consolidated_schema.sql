-- migrations/0000_consolidated_schema.sql
-- Complete additive schema for Xylem/Aylem Learning production D1

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  cf_order_id TEXT,
  customer_id TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_json TEXT,
  items_json TEXT,
  coupon_code TEXT,
  discount_paise INTEGER DEFAULT 0,
  promotion_snapshot_json TEXT,
  cf_payment_id TEXT,
  verified_amount_paise INTEGER,
  reconciliation_state TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_cf_order_id ON orders(cf_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_cf_payment_id ON orders(cf_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_reconciliation_state ON orders(reconciliation_state);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  raw_payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  add_on_id TEXT,
  title TEXT NOT NULL,
  file_reference_json TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  granted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entitlements_order_id ON entitlements(order_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_product_id ON entitlements(product_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_add_on_id ON entitlements(add_on_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS order_claims (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  claim_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'POST_PAYMENT_ACCOUNT_CLAIM',
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_claims_order_id ON order_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_order_claims_claim_hash ON order_claims(claim_hash);

CREATE TABLE IF NOT EXISTS customer_login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  admin_identity TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_events(created_at DESC);

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
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  archived_at TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dfv_product_lookup ON digital_file_versions(product_id, status);
CREATE INDEX IF NOT EXISTS idx_dfv_product_addon_lookup ON digital_file_versions(product_id, add_on_id, status);
CREATE INDEX IF NOT EXISTS idx_dfv_created_at ON digital_file_versions(created_at DESC);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'COUPON',
  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  expires_at TEXT,
  minimum_order_paise INTEGER NOT NULL DEFAULT 0,
  maximum_discount_paise INTEGER,
  usage_limit INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER NOT NULL DEFAULT 1,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  applicable_product_ids_json TEXT,
  applicable_addon_ids_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  promotion_code TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  customer_email TEXT,
  discount_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redemptions_promo ON promotion_redemptions(promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON promotion_redemptions(customer_id, promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_email ON promotion_redemptions(customer_email, promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_order ON promotion_redemptions(order_id);

INSERT OR IGNORE INTO promotions (
  id, code, name, type, discount_type, discount_value, active, starts_at, expires_at,
  minimum_order_paise, maximum_discount_paise, usage_limit, times_used,
  per_customer_limit, first_order_only, applicable_product_ids_json, applicable_addon_ids_json,
  created_at, updated_at
) VALUES
  ('promo_seed_xylem20', 'XYLEM20', 'Flat 20% Discount', 'COUPON', 'PERCENTAGE', 20, 1, NULL, NULL, 0, NULL, NULL, 0, 5, 0, NULL, NULL, datetime('now'), datetime('now')),
  ('promo_seed_first50', 'FIRST50', 'First Time Learner ₹50 Off', 'COUPON', 'FIXED_AMOUNT', 5000, 1, NULL, NULL, 0, NULL, NULL, 0, 1, 1, NULL, NULL, datetime('now'), datetime('now')),
  ('promo_seed_specialoffer', 'SPECIALOFFER', 'Special Seasonal 15% Off', 'COUPON', 'PERCENTAGE', 15, 1, NULL, NULL, 0, NULL, NULL, 0, 5, 0, NULL, NULL, datetime('now'), datetime('now')),
  ('promo_seed_offer67', 'OFFER67', 'Partner Voucher 15% Off', 'COUPON', 'PERCENTAGE', 15, 1, NULL, NULL, 0, NULL, NULL, 0, 5, 0, NULL, NULL, datetime('now'), datetime('now'));

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  product_id TEXT,
  add_on_id TEXT,
  order_id TEXT,
  customer_id TEXT,
  session_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events(event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_addon ON analytics_events(add_on_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_order ON analytics_events(order_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
