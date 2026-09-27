-- migrations/0007_phase11_analytics.sql
-- Phase 11: First-Party Analytics, Sales Funnel, Product & Add-on Performance Metrics
-- Lightweight, first-party event model designed to minimize D1 usage on Cloudflare Free plan.

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

-- Indexes for efficient dashboard aggregation without full table scans
CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events(event_type, event_date);
CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_addon ON analytics_events(add_on_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_order ON analytics_events(order_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
