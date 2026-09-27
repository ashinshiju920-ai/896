-- Test seed data for Phase 8 tests
INSERT OR IGNORE INTO orders (id, cf_order_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, items_json, created_at, updated_at, verified_amount_paise, reconciliation_state)
VALUES
  ('order_p8_paid_001', 'order_p8_paid_001', 59900, 'INR', 'PAID', 'Test Paid Student', 'paid@example.com', '9876543210', '[{"title":"Xylem NEET Guide 2025","productId":"book_001","deliveryOption":"digital","unitPricePaise":59900,"quantity":1}]', '2026-09-01T10:00:00Z', '2026-09-01T10:05:00Z', 59900, 'MATCHED'),
  ('order_p8_pending_001', 'order_p8_pending_001', 39900, 'INR', 'PENDING', 'Pending Student', 'pending@example.com', '9876543211', '[{"title":"Xylem JEE Guide","productId":"book_002","deliveryOption":"digital","unitPricePaise":39900,"quantity":1}]', '2026-09-02T10:00:00Z', '2026-09-02T10:00:00Z', NULL, 'UNKNOWN'),
  ('order_p8_failed_001', 'order_p8_failed_001', 29900, 'INR', 'FAILED', 'Failed Student', 'failed@example.com', '9876543212', '[{"title":"Xylem UPSC Guide","productId":"book_003","deliveryOption":"digital","unitPricePaise":29900,"quantity":1}]', '2026-09-03T10:00:00Z', '2026-09-03T10:00:00Z', NULL, 'UNKNOWN'),
  ('order_p8_dropped_001', 'order_p8_dropped_001', 19900, 'INR', 'USER_DROPPED', 'Dropped Student', 'dropped@example.com', '9876543213', '[{"title":"Xylem SSC Guide","productId":"book_004","deliveryOption":"digital","unitPricePaise":19900,"quantity":1}]', '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z', NULL, 'UNKNOWN');

INSERT OR IGNORE INTO order_events (id, order_id, event_type, raw_payload, created_at)
VALUES
  ('evt_p8_001', 'order_p8_paid_001', 'ORDER_CREATED', '{}', '2026-09-01T10:00:00Z'),
  ('evt_p8_002', 'order_p8_paid_001', 'PAYMENT_SUCCESS', '{"paymentId":"cf_pay_test_001"}', '2026-09-01T10:03:00Z'),
  ('evt_p8_003', 'order_p8_paid_001', 'ORDER_MARKED_PAID', '{"paymentId":"cf_pay_test_001"}', '2026-09-01T10:03:01Z');
