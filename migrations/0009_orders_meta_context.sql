-- Persist browser Meta context captured at checkout/order creation.
-- Used by server-side Purchase CAPI when Cashfree webhooks arrive before return-page requests.

ALTER TABLE orders ADD COLUMN meta_context_json TEXT;
