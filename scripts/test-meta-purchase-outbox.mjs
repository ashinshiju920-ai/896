import assert from 'node:assert/strict';
import { deliverMetaPurchaseEvent } from '../functions/utils/metaCapi.js';
import { getMetaPurchaseEventId } from '../functions/utils/db.js';

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) {
    this.args = args;
    return this;
  }
  async run() {
    return this.db.run(this.sql, this.args);
  }
  async first() {
    return this.db.first(this.sql, this.args);
  }
}

class FakeDB {
  constructor() {
    this.meta = new Map();
    this.orderEvents = [];
  }
  prepare(sql) {
    return new FakeStatement(this, sql);
  }
  async run(sql, args) {
    const norm = sql.replace(/\s+/g, ' ').trim();

    if (norm.startsWith('INSERT OR IGNORE INTO meta_purchase_events')) {
      const [orderId, eventId, valuePaise, currency, source, nextAttemptAt, createdAt, updatedAt] = args;
      if (!this.meta.has(orderId)) {
        this.meta.set(orderId, {
          order_id: orderId,
          event_id: eventId,
          status: 'PENDING',
          attempts: 0,
          value_paise: valuePaise,
          currency,
          last_source: source,
          last_error: null,
          next_attempt_at: nextAttemptAt,
          processing_started_at: null,
          sent_at: null,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (norm.startsWith('UPDATE meta_purchase_events SET value_paise')) {
      const [valuePaise, currency, source, updatedAt, orderId] = args;
      const row = this.meta.get(orderId);
      if (row && row.status !== 'SENT') {
        row.value_paise ??= valuePaise;
        row.currency ||= currency;
        row.last_source = source;
        row.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (norm.startsWith("UPDATE meta_purchase_events SET status = 'PROCESSING'")) {
      const [processingStartedAt, source, updatedAt, orderId, now, staleBefore] = args;
      const row = this.meta.get(orderId);
      const ready =
        row &&
        row.status !== 'SENT' &&
        (
          row.status === 'PENDING' ||
          (row.status === 'FAILED' && (!row.next_attempt_at || row.next_attempt_at <= now)) ||
          (row.status === 'PROCESSING' && row.processing_started_at && row.processing_started_at < staleBefore)
        );
      if (!ready) return { meta: { changes: 0 } };
      row.status = 'PROCESSING';
      row.attempts += 1;
      row.processing_started_at = processingStartedAt;
      row.last_source = source;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (norm.startsWith("UPDATE meta_purchase_events SET status = 'SENT'")) {
      const [sentAt, updatedAt, orderId] = args;
      const row = this.meta.get(orderId);
      if (row?.status === 'PROCESSING') {
        row.status = 'SENT';
        row.sent_at = sentAt;
        row.last_error = null;
        row.processing_started_at = null;
        row.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (norm.startsWith("UPDATE meta_purchase_events SET status = 'FAILED'")) {
      const [error, nextAttemptAt, updatedAt, orderId] = args;
      const row = this.meta.get(orderId);
      if (row?.status === 'PROCESSING') {
        row.status = 'FAILED';
        row.last_error = error;
        row.next_attempt_at = nextAttemptAt;
        row.processing_started_at = null;
        row.updated_at = updatedAt;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (norm.startsWith('INSERT INTO order_events')) {
      this.orderEvents.push(args);
      return { meta: { changes: 1 } };
    }

    throw new Error(`Unhandled SQL run: ${norm}`);
  }
  async first(sql, args) {
    const norm = sql.replace(/\s+/g, ' ').trim();
    if (norm.startsWith('SELECT * FROM meta_purchase_events WHERE order_id = ?')) {
      const row = this.meta.get(args[0]);
      return row ? { ...row } : null;
    }
    throw new Error(`Unhandled SQL first: ${norm}`);
  }
}

function paidOrder(overrides = {}) {
  return {
    id: 'order_meta_001',
    status: 'PAID',
    amount_paise: 19900,
    currency: 'INR',
    customer_name: 'Test Student',
    customer_email: 'student@example.com',
    customer_phone: '9876543210',
    items: [{ productId: 'ielts-guide', quantity: 1, unitPricePaise: 19900 }],
    ...overrides,
  };
}

async function withFetch(handler, fn) {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await fn();
  } finally {
    globalThis.fetch = oldFetch;
  }
}

async function run() {
  console.log('\nMETA PURCHASE OUTBOX TESTS');
  console.log('==========================');

  assert.equal(getMetaPurchaseEventId('abc'), 'purchase_abc');
  console.log('  ✓ Stable event ID helper');

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    let calls = 0;
    await withFetch(async (_url, init) => {
      calls += 1;
      const payload = JSON.parse(init.body);
      assert.equal(payload.data[0].event_id, 'purchase_order_meta_001');
      assert.equal(payload.data[0].custom_data.value, 199);
      assert.equal(payload.data[0].custom_data.currency, 'INR');
      return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'trace-1' }), { status: 200 });
    }, async () => {
      const first = await deliverMetaPurchaseEvent(env, paidOrder(), { source: 'TEST_SUCCESS' });
      const second = await deliverMetaPurchaseEvent(env, paidOrder(), { source: 'TEST_DUPLICATE' });
      assert.equal(first.success, true);
      assert.equal(second.reason, 'ALREADY_SENT');
      assert.equal(calls, 1);
      assert.equal(db.meta.get('order_meta_001').status, 'SENT');
    });
    console.log('  ✓ One successful payment sends once and duplicate request is skipped');
  }

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'Meta unavailable' } }), { status: 500 });
    }, async () => {
      const failed = await deliverMetaPurchaseEvent(env, paidOrder({ id: 'order_meta_500' }), { source: 'TEST_500' });
      const skipped = await deliverMetaPurchaseEvent(env, paidOrder({ id: 'order_meta_500' }), { source: 'TEST_500_AGAIN' });
      assert.equal(failed.success, false);
      assert.equal(failed.retryable, true);
      assert.equal(skipped.reason, 'NOT_READY');
      assert.equal(calls, 1);
      assert.equal(db.meta.get('order_meta_500').status, 'FAILED');

      db.meta.get('order_meta_500').next_attempt_at = new Date(Date.now() - 1000).toISOString();
      globalThis.fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'trace-retry' }), { status: 200 });
      };
      const retried = await deliverMetaPurchaseEvent(env, paidOrder({ id: 'order_meta_500' }), { source: 'TEST_RETRY' });
      assert.equal(retried.success, true);
      assert.equal(db.meta.get('order_meta_500').status, 'SENT');
      assert.equal(calls, 2);
    });
    console.log('  ✓ 500 response is retryable and later retry succeeds');
  }

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      throw new Error('timeout');
    }, async () => {
      const result = await deliverMetaPurchaseEvent(env, paidOrder({ id: 'order_meta_timeout' }), { source: 'TEST_TIMEOUT' });
      assert.equal(result.success, false);
      assert.equal(result.retryable, true);
      assert.equal(db.meta.get('order_meta_timeout').status, 'FAILED');
      assert.equal(calls, 1);
    });
    console.log('  ✓ Meta timeout is retryable');
  }

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    }, async () => {
      const result = await deliverMetaPurchaseEvent(env, paidOrder({ status: 'FAILED' }), { source: 'TEST_FAILED_PAYMENT' });
      assert.equal(result.reason, 'ORDER_NOT_PAID');
      assert.equal(calls, 0);
      assert.equal(db.meta.size, 0);
    });
    console.log('  ✓ Failed payment does not enqueue or send Purchase');
  }

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    const order = paidOrder({
      id: 'order_meta_context',
      meta_context_json: JSON.stringify({
        fbp: 'fb.1.1700000000000.111',
        fbc: 'fb.1.1700000000000.AbCdEf',
        client_ip_address: '203.0.113.10',
        client_user_agent: 'Mozilla/5.0 MetaContextTest',
        event_source_url: 'https://aylemlearning.online/checkout',
        referrer_url: 'https://facebook.com/ad-click',
      }),
    });
    await withFetch(async (_url, init) => {
      const payload = JSON.parse(init.body);
      const event = payload.data[0];
      assert.equal(event.event_id, 'purchase_order_meta_context');
      assert.equal(event.event_source_url, 'https://aylemlearning.online/checkout');
      assert.equal(event.referrer_url, 'https://facebook.com/ad-click');
      assert.equal(event.user_data.fbp, 'fb.1.1700000000000.111');
      assert.equal(event.user_data.fbc, 'fb.1.1700000000000.AbCdEf');
      assert.equal(event.user_data.client_ip_address, '203.0.113.10');
      assert.equal(event.user_data.client_user_agent, 'Mozilla/5.0 MetaContextTest');
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }, async () => {
      const result = await deliverMetaPurchaseEvent(env, order, { source: 'TEST_STORED_META_CONTEXT' });
      assert.equal(result.success, true);
    });
    console.log('  OK Stored checkout Meta context is included for webhook-style CAPI sends');
  }

  {
    const db = new FakeDB();
    const env = { DB: db, META_CAPI_ACCESS_TOKEN: 'test-token', META_PIXEL_ID: 'pixel-1' };
    const order = paidOrder({ id: 'order_meta_processing' });
    await withFetch(async () => {
      throw new Error('worker interrupted after claim');
    }, async () => {
      const result = await deliverMetaPurchaseEvent(env, order, { source: 'TEST_INTERRUPTION' });
      assert.equal(result.retryable, true);
      assert.equal(db.meta.get(order.id).status, 'FAILED');
      db.meta.get(order.id).next_attempt_at = new Date(Date.now() - 1000).toISOString();
    });
    let calls = 0;
    await withFetch(async () => {
      calls += 1;
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    }, async () => {
      const retry = await deliverMetaPurchaseEvent(env, order, { source: 'TEST_INTERRUPTION_RETRY' });
      assert.equal(retry.success, true);
      assert.equal(calls, 1);
    });
    console.log('  ✓ Interrupted/failed processing can retry with same event ID');
  }

  console.log('\nALL META PURCHASE OUTBOX TESTS PASSED');
}

run().catch((err) => {
  console.error('\nMETA PURCHASE OUTBOX TESTS FAILED');
  console.error(err);
  process.exit(1);
});
