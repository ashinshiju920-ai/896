-- migrations/0004_phase8_admin_ops.sql
-- Phase 8: Admin Operations, Payment Reconciliation, Fulfillment Monitoring
-- Adds payment reconciliation fields, admin audit log, and search-friendly indexes.

-- 1. Add Cashfree payment ID and verified amount to orders table
--    cf_payment_id:        Cashfree payment reference from webhook (safe to display)
--    verified_amount_paise: The actual amount Cashfree confirmed payment for (integer paise)
--    reconciliation_state: MATCHED | MISMATCH | UNKNOWN
ALTER TABLE orders ADD COLUMN cf_payment_id TEXT;
ALTER TABLE orders ADD COLUMN verified_amount_paise INTEGER;
ALTER TABLE orders ADD COLUMN reconciliation_state TEXT NOT NULL DEFAULT 'UNKNOWN';

-- 2. Admin Audit Events — records meaningful admin actions
--    Stores who did what, to which target, when.
--    NEVER stores passwords, session tokens, secrets, or claim tokens.
CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  admin_identity TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- 3. Indexes
-- Efficient search by Cashfree payment ID
CREATE INDEX IF NOT EXISTS idx_orders_cf_payment_id ON orders(cf_payment_id);
-- Efficient search by reconciliation state (for finding mismatches/unknowns)
CREATE INDEX IF NOT EXISTS idx_orders_reconciliation_state ON orders(reconciliation_state);
-- Composite index: status + created_at for paginated filtered lists
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
-- Admin audit log: by target
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_events(created_at DESC);
