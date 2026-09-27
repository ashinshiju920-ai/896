-- migrations/0006_phase10_promotions.sql
-- Phase 10: Promotions, Coupons, Bundles, and Promotional Pricing

-- 1. Promotions Table
--    Stores server-authoritative coupon codes, product offers, and bundle discount rules.
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'COUPON', -- 'COUPON' | 'PRODUCT_OFFER' | 'BUNDLE_OFFER'
  discount_type TEXT NOT NULL,        -- 'PERCENTAGE' | 'FIXED_AMOUNT'
  discount_value INTEGER NOT NULL,     -- Percentage (e.g. 20) or Integer Paise (e.g. 5000 for ₹50)
  active INTEGER NOT NULL DEFAULT 1,   -- 1 = active, 0 = disabled
  starts_at TEXT,                     -- ISO 8601 string or NULL
  expires_at TEXT,                    -- ISO 8601 string or NULL
  minimum_order_paise INTEGER NOT NULL DEFAULT 0,
  maximum_discount_paise INTEGER,     -- Optional ceiling in paise
  usage_limit INTEGER,                -- Global usage cap (NULL = unlimited)
  times_used INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER NOT NULL DEFAULT 1,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  applicable_product_ids_json TEXT,   -- JSON array of book IDs or NULL/empty
  applicable_addon_ids_json TEXT,     -- JSON array of add-on IDs or NULL/empty
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Promotion Redemptions Table
--    Records verified coupon usage per paid order, enforcing concurrency & per-customer limits.
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

-- 3. Extend orders table with promotion fields
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_paise INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN promotion_snapshot_json TEXT;

-- 4. High-performance indexes for Cloudflare Free plan
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);
CREATE INDEX IF NOT EXISTS idx_redemptions_promo ON promotion_redemptions(promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON promotion_redemptions(customer_id, promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_email ON promotion_redemptions(customer_email, promotion_code);
CREATE INDEX IF NOT EXISTS idx_redemptions_order ON promotion_redemptions(order_id);

-- 5. Seed established default verified coupons
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
