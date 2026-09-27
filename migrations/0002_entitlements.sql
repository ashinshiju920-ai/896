-- migrations/0002_entitlements.sql
-- Digital Entitlements Schema for Order Fulfillment (Phase 1)
-- Stores authoritative access grants for main products and specific purchased add-ons.

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

-- Fast lookup indexes for entitlement checks and order resolution
CREATE INDEX IF NOT EXISTS idx_entitlements_order_id ON entitlements(order_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_product_id ON entitlements(product_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_add_on_id ON entitlements(add_on_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);
