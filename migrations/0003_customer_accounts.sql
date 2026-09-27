-- migrations/0003_customer_accounts.sql
-- Cloudflare D1 Schema for Customer Accounts, Sessions, and Order Claims (Phase 7)

-- 1. Customer Accounts Table
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

-- 2. Customer Sessions Table (Stores SHA-256 hash of session token, never raw token)
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

-- 3. Post-Payment Order Claims Table (Stores SHA-256 hash of one-time claim secret)
CREATE TABLE IF NOT EXISTS order_claims (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  claim_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'POST_PAYMENT_ACCOUNT_CLAIM',
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

-- 4. Customer Login Rate Limiting Table (Local/D1 brute-force protection)
CREATE TABLE IF NOT EXISTS customer_login_attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

-- 5. Order Customer Link (Adds customer_id to orders table)
ALTER TABLE orders ADD COLUMN customer_id TEXT;

-- 6. Indexes for fast, low-cost queries on Cloudflare Free plan
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_id ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires_at ON customer_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_order_claims_order_id ON order_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_order_claims_claim_hash ON order_claims(claim_hash);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
