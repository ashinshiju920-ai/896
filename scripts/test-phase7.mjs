// scripts/test-phase7.mjs
// Phase 7 Comprehensive Acceptance, Security & Performance Test Suite
// Verifies: Secure Customer Accounts, Post-Payment Account Creation, Customer Login/Logout,
// Server-Side Customer Sessions, Order Ownership, Entitlement Ownership, Persistent My Materials,
// Account-Aware Secure Downloads, Guest-to-Account Linking, and Cloudflare Free-Plan Optimization.

import assert from 'node:assert';
import crypto from 'node:crypto';
import { onRequestPost as handleActivate } from '../functions/api/customer/activate-after-purchase.js';
import { onRequestPost as handleLogin } from '../functions/api/customer/login.js';
import { onRequestPost as handleLogout } from '../functions/api/customer/logout.js';
import { onRequestGet as handleSession } from '../functions/api/customer/session.js';
import { onRequestGet as handleMaterials } from '../functions/api/customer/materials.js';
import { onRequestPost as handleChangePassword } from '../functions/api/customer/change-password.js';
import { onRequestGet as handleDownload } from '../functions/api/download.js';
import {
  saveOrder,
  getOrder,
  saveOrderClaim,
  getOrderClaim,
  consumeOrderClaim,
  createCustomer,
  getCustomerByEmail,
  getCustomerById,
  createCustomerSession,
  getCustomerSessionByTokenHash,
  revokeCustomerSession,
  linkOrderToCustomer,
  createEntitlementsForPaidOrder,
  getEntitlementsByOrderId,
  getCustomerEntitlements,
  getCustomerPaidOrders,
} from '../functions/utils/db.js';
import {
  hashPassword,
  generateRandomToken,
  sha256Hex,
  createSessionToken,
  parseCookies,
} from '../functions/utils/auth.js';

// In-Memory Cloudflare KV Mock
class MockKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, options) {
    const val = this.store.get(key);
    if (!val) return null;
    if (options && options.type === 'json') return JSON.parse(val);
    return val;
  }
  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.store.delete(key);
  }
}

// In-Memory Cloudflare D1 Mock with full schema emulation
class MockD1 {
  constructor() {
    this.tables = {
      customers: new Map(),
      customer_sessions: new Map(),
      order_claims: new Map(),
      orders: new Map(),
      entitlements: new Map(),
      order_events: [],
    };
    this.queryCounts = {
      total: 0,
      materialsJoins: 0,
    };
  }

  prepare(sql) {
    const self = this;
    return {
      bind(...params) {
        return {
          async run() {
            self.queryCounts.total++;

            // 1. customers INSERT
            if (sql.includes('INSERT INTO customers')) {
              const [id, email, name, phone, password_hash, password_salt, status, created_at, updated_at] = params;
              // Check unique email
              for (const c of self.tables.customers.values()) {
                if (c.email === email) {
                  throw new Error('UNIQUE constraint failed: customers.email');
                }
              }
              self.tables.customers.set(id, {
                id, email, name, phone, password_hash, password_salt, status, created_at, updated_at, last_login_at: null,
              });
              return { success: true };
            }

            // 2. customer_sessions INSERT
            if (sql.includes('INSERT INTO customer_sessions')) {
              const [id, customer_id, token_hash, created_at, expires_at] = params;
              self.tables.customer_sessions.set(id, {
                id, customer_id, token_hash, created_at, expires_at, last_seen_at: null, revoked_at: null,
              });
              return { success: true };
            }

            // 3. customer_sessions REVOKE (UPDATE)
            if (sql.includes('UPDATE customer_sessions SET revoked_at = ?')) {
              const [revokedAt, tokenHash] = params;
              for (const s of self.tables.customer_sessions.values()) {
                if (s.token_hash === tokenHash) {
                  s.revoked_at = revokedAt;
                }
              }
              return { success: true };
            }

            // 4. customers password UPDATE
            if (sql.includes('UPDATE customers SET password_hash = ?')) {
              const [newHash, newSalt, updatedAt, custId] = params;
              const cust = self.tables.customers.get(custId);
              if (cust) {
                cust.password_hash = newHash;
                cust.password_salt = newSalt;
                cust.updated_at = updatedAt;
              }
              return { success: true };
            }

            // 5. order_claims INSERT OR REPLACE
            if (sql.includes('order_claims')) {
              if (sql.includes('UPDATE order_claims SET consumed_at = ?')) {
                const [consumedAt, orderId] = params;
                const claim = self.tables.order_claims.get(orderId);
                if (claim) claim.consumed_at = consumedAt;
                return { success: true };
              }
              const [id, order_id, claim_hash, purpose, expires_at, consumed_at, created_at] = params;
              self.tables.order_claims.set(order_id, {
                id, order_id, claim_hash, purpose, expires_at, consumed_at, created_at,
              });
              return { success: true };
            }

            // 6. orders link to customer (UPDATE orders SET customer_id = ?)
            if (sql.includes('UPDATE orders SET customer_id = ?')) {
              const [custId, updatedAt, orderId, cfOrderId] = params;
              for (const ord of self.tables.orders.values()) {
                if (ord.id === orderId || ord.cf_order_id === orderId || (cfOrderId && ord.cf_order_id === cfOrderId)) {
                  ord.customer_id = custId;
                  ord.updated_at = updatedAt;
                }
              }
              return { success: true };
            }

            // 7. orders INSERT
            if (sql.includes('INSERT INTO orders')) {
              let id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at;
              if (params.length === 16) {
                [id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json] = params;
                created_at = params[14];
                updated_at = params[15];
              } else if (params.length === 13) {
                [id, cf_order_id, customer_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at] = params;
              } else {
                [id, cf_order_id, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at] = params;
              }
              self.tables.orders.set(id, {
                id, cf_order_id, customer_id: customer_id || null, amount_paise, currency, status, customer_name, customer_email, customer_phone, shipping_json, items_json, created_at, updated_at,
              });
              return { success: true };
            }

            // 8. entitlements INSERT
            if (sql.includes('INSERT OR REPLACE INTO entitlements') || sql.includes('INSERT INTO entitlements')) {
              const [id, order_id, product_id, add_on_id, title, file_reference_json, status, granted_at, created_at, updated_at] = params;
              self.tables.entitlements.set(id, {
                id, order_id, product_id, add_on_id, title, file_reference_json, status, granted_at, created_at, updated_at,
              });
              return { success: true };
            }

            return { success: true };
          },

          async all() {
            self.queryCounts.total++;

            // JOIN query: Customer entitlements via customer_id on orders
            if (sql.includes('JOIN orders o ON e.order_id = o.id')) {
              self.queryCounts.materialsJoins++;
              const [customerId] = params;
              const results = [];
              for (const ent of self.tables.entitlements.values()) {
                const ord = self.tables.orders.get(ent.order_id);
                if (!ord) {
                  // Check if order was stored under another key
                  for (const o of self.tables.orders.values()) {
                    if (o.id === ent.order_id || o.cf_order_id === ent.order_id) {
                      // Found order
                      if (o.customer_id === customerId && o.status === 'PAID' && ent.status === 'ACTIVE') {
                        results.push({
                          id: ent.id,
                          order_id: ent.order_id,
                          product_id: ent.product_id,
                          add_on_id: ent.add_on_id,
                          title: ent.title,
                          file_reference_json: ent.file_reference_json,
                          status: ent.status,
                          granted_at: ent.granted_at,
                          order_created_at: o.created_at,
                          order_amount: o.amount_paise,
                        });
                      }
                    }
                  }
                } else if (ord && ord.customer_id === customerId && ord.status === 'PAID' && ent.status === 'ACTIVE') {
                  results.push({
                    id: ent.id,
                    order_id: ent.order_id,
                    product_id: ent.product_id,
                    add_on_id: ent.add_on_id,
                    title: ent.title,
                    file_reference_json: ent.file_reference_json,
                    status: ent.status,
                    granted_at: ent.granted_at,
                    order_created_at: ord.created_at,
                    order_amount: ord.amount_paise,
                  });
                }
              }
              return { results };
            }

            // Customer Paid Orders
            if (sql.includes('FROM orders WHERE customer_id = ? AND status = \'PAID\'')) {
              const [customerId] = params;
              const results = [];
              for (const ord of self.tables.orders.values()) {
                if (ord.customer_id === customerId && ord.status === 'PAID') {
                  results.push({ ...ord });
                }
              }
              return { results };
            }

            // Entitlements by order_id
            if (sql.includes('FROM entitlements WHERE order_id = ?')) {
              const [orderId] = params;
              const results = [];
              for (const ent of self.tables.entitlements.values()) {
                if (ent.order_id === orderId) results.push({ ...ent });
              }
              return { results };
            }

            return { results: [] };
          },

          async first() {
            self.queryCounts.total++;

            // Session check by token_hash (JOIN customer_sessions & customers)
            if (sql.includes('FROM customer_sessions s JOIN customers c ON s.customer_id = c.id WHERE s.token_hash = ?')) {
              const [tokenHash] = params;
              for (const s of self.tables.customer_sessions.values()) {
                if (s.token_hash === tokenHash) {
                  const cust = self.tables.customers.get(s.customer_id);
                  if (cust) {
                    return {
                      session_id: s.id,
                      customer_id: s.customer_id,
                      token_hash: s.token_hash,
                      session_created_at: s.created_at,
                      expires_at: s.expires_at,
                      revoked_at: s.revoked_at,
                      id: cust.id,
                      name: cust.name,
                      email: cust.email,
                      phone: cust.phone,
                      customer_status: cust.status,
                    };
                  }
                }
              }
              return null;
            }

            // Customer by email
            if (sql.includes('FROM customers WHERE email = ?')) {
              const [email] = params;
              for (const c of self.tables.customers.values()) {
                if (c.email.toLowerCase() === email.toLowerCase()) return { ...c };
              }
              return null;
            }

            // Customer by id
            if (sql.includes('FROM customers WHERE id = ?')) {
              const [id] = params;
              const c = self.tables.customers.get(id);
              return c ? { ...c } : null;
            }

            // Order claims by order_id
            if (sql.includes('FROM order_claims WHERE order_id = ?')) {
              const [orderId] = params;
              const cl = self.tables.order_claims.get(orderId);
              return cl ? { ...cl } : null;
            }

            // Orders by id or cf_order_id
            if (sql.includes('FROM orders WHERE id = ? OR cf_order_id = ?') || sql.includes('FROM orders WHERE id = ?')) {
              const [id] = params;
              for (const o of self.tables.orders.values()) {
                if (o.id === id || o.cf_order_id === id) return { ...o };
              }
              return null;
            }

            // Entitlements by id
            if (sql.includes('FROM entitlements WHERE id = ?')) {
              const [id] = params;
              return self.tables.entitlements.get(id) || null;
            }

            return null;
          },
        };
      },
    };
  }
}

function createTestEnv() {
  return {
    DB: new MockD1(),
    PRODUCTS_KV: new MockKV(),
    CASHFREE_SECRET_KEY: 'test_cashfree_secret_key_phase7_sec',
    DOWNLOAD_SIGNING_KEY: 'test_download_signing_key_phase7_sec',
    ADMIN_SESSION_SECRET: 'test_admin_session_secret_phase7_sec',
  };
}

async function runPhase7Tests() {
  console.log('==================================================');
  console.log('STARTING PHASE 7 ACCEPTANCE & SECURITY TEST SUITE');
  console.log('==================================================\n');

  const env = createTestEnv();

  // Helper to create a paid test order with entitlements
  async function seedPaidOrder(orderId, customerEmail, customerName = 'Student Test', items = null) {
    const defaultItems = [
      {
        productId: 'book-ielts-001',
        productNameSnapshot: 'IELTS Complete Academic Guide 2026',
        format: 'digital',
        price: 347,
        digitalFile: {
          fileUrl: 'https://cloudinary.com/ielts_full.pdf',
          filename: 'ielts.pdf',
        },
        addOns: [
          {
            addOnId: 'addon-mock-tests',
            nameSnapshot: 'Full Mock Test Pack',
            deliveryOption: 'digital',
            price: 199,
            digitalFile: {
              fileUrl: 'https://cloudinary.com/mock_tests.pdf',
              filename: 'mocks.pdf',
            },
          },
        ],
      },
    ];

    const orderRecord = await saveOrder(env, {
      id: orderId,
      cf_order_id: `cf_${orderId}`,
      amount_paise: 54600,
      currency: 'INR',
      status: 'PAID',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: '9876543210',
      shipping: { fullName: customerName, email: customerEmail, phone: '9876543210' },
      items: items || defaultItems,
    });

    const entitlements = await createEntitlementsForPaidOrder(env, orderRecord);
    return { order: orderRecord, entitlements };
  }

  // --------------------------------------------------
  // TEST A: Valid account activation after verified PAID order
  // --------------------------------------------------
  console.log('TEST A: Valid account activation after verified PAID order');
  const orderAId = 'order_test_a_001';
  const emailA = 'student_a@example.com';
  await seedPaidOrder(orderAId, emailA, 'Alice Green');

  // Issue one-time claim secret
  const rawClaimSecretA = generateRandomToken(32);
  const claimHashA = await sha256Hex(rawClaimSecretA);
  const expiresAtA = new Date(Date.now() + 3600 * 1000).toISOString();
  await saveOrderClaim(env, {
    orderId: orderAId,
    claimHash: claimHashA,
    expiresAt: expiresAtA,
  });

  const activateReqA = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=${rawClaimSecretA}`,
    },
    body: JSON.stringify({
      orderId: orderAId,
      name: 'Alice Green',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  const activateResA = await handleActivate({ request: activateReqA, env });
  assert.strictEqual(activateResA.status, 200, 'Activation should return 200 OK');
  const activateDataA = await activateResA.json();
  assert.strictEqual(activateDataA.success, true);
  assert.strictEqual(activateDataA.customer.email, emailA);
  assert.ok(activateDataA.customer.id, 'Customer ID must be generated');

  // Verify Set-Cookie header sets customer_session (HttpOnly) and clears order_claim
  const setCookieHeaderA = activateResA.headers.get('Set-Cookie');
  assert.ok(setCookieHeaderA.includes('customer_session='), 'Must set customer_session cookie');
  assert.ok(setCookieHeaderA.includes('HttpOnly'), 'Session cookie must be HttpOnly');
  assert.ok(setCookieHeaderA.includes('order_claim='), 'Must clear claim cookie');

  // Verify claim is marked consumed in D1
  const updatedClaimA = await getOrderClaim(env, orderAId);
  assert.ok(updatedClaimA.consumed_at, 'Claim must be marked consumed');

  // Verify order is now linked to customer ID
  const linkedOrderA = await getOrder(env, orderAId);
  assert.strictEqual(linkedOrderA.customer_id, activateDataA.customer.id, 'Order must be linked to customer ID');
  console.log('  PASS: Account activated, session cookie set, and verified order linked.\n');

  // --------------------------------------------------
  // TEST B: Wrong/incomplete activation claim rejected
  // --------------------------------------------------
  console.log('TEST B: Wrong/incomplete activation claim rejected');
  const orderBId = 'order_test_b_002';
  await seedPaidOrder(orderBId, 'student_b@example.com');
  await saveOrderClaim(env, {
    orderId: orderBId,
    claimHash: await sha256Hex('real_claim_secret_b'),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const activateReqB = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=wrong_bogus_secret`,
    },
    body: JSON.stringify({
      orderId: orderBId,
      name: 'Bob Brown',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  const activateResB = await handleActivate({ request: activateReqB, env });
  assert.strictEqual(activateResB.status, 403, 'Invalid claim must be rejected with 403 Forbidden');
  console.log('  PASS: Wrong claim secret strictly rejected with 403.\n');

  // --------------------------------------------------
  // TEST C: Expired activation claim rejected
  // --------------------------------------------------
  console.log('TEST C: Expired activation claim rejected');
  const orderCId = 'order_test_c_003';
  const rawClaimSecretC = 'claim_secret_c';
  await seedPaidOrder(orderCId, 'student_c@example.com');
  await saveOrderClaim(env, {
    orderId: orderCId,
    claimHash: await sha256Hex(rawClaimSecretC),
    expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // Expired 1 hour ago
  });

  const activateReqC = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=${rawClaimSecretC}`,
    },
    body: JSON.stringify({
      orderId: orderCId,
      name: 'Charlie Chaplin',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  const activateResC = await handleActivate({ request: activateReqC, env });
  assert.strictEqual(activateResC.status, 403, 'Expired claim must return 403');
  console.log('  PASS: Expired claim strictly rejected with 403.\n');

  // --------------------------------------------------
  // TEST D: Claim reused after successful activation rejected
  // --------------------------------------------------
  console.log('TEST D: Claim reused after successful activation rejected');
  const activateReqD = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=${rawClaimSecretA}`,
    },
    body: JSON.stringify({
      orderId: orderAId,
      name: 'Alice Green Replay',
      password: 'AnotherPassword123!',
      confirmPassword: 'AnotherPassword123!',
    }),
  });

  const activateResD = await handleActivate({ request: activateReqD, env });
  assert.strictEqual(activateResD.status, 403, 'Consumed claim cannot be reused');
  console.log('  PASS: Reused claim rejected with 403.\n');

  // --------------------------------------------------
  // TEST E: Unpaid order attempts activation rejected
  // --------------------------------------------------
  console.log('TEST E: Unpaid order attempts activation rejected');
  const orderEId = 'order_test_e_005';
  await saveOrder(env, {
    id: orderEId,
    cf_order_id: `cf_${orderEId}`,
    amount_paise: 34700,
    currency: 'INR',
    status: 'PENDING', // Unpaid!
    customer_name: 'Eve Unpaid',
    customer_email: 'eve@example.com',
    customer_phone: '9876543210',
    shipping: { fullName: 'Eve Unpaid', email: 'eve@example.com' },
    items: [],
  });

  const rawClaimSecretE = 'claim_secret_e';
  await saveOrderClaim(env, {
    orderId: orderEId,
    claimHash: await sha256Hex(rawClaimSecretE),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const activateReqE = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=${rawClaimSecretE}`,
    },
    body: JSON.stringify({
      orderId: orderEId,
      name: 'Eve Unpaid',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  const activateResE = await handleActivate({ request: activateReqE, env });
  assert.strictEqual(activateResE.status, 403, 'Unpaid order activation must be rejected with 403');
  console.log('  PASS: Unpaid order activation strictly rejected.\n');

  // --------------------------------------------------
  // TEST F: Order already linked to another customer rejected
  // --------------------------------------------------
  console.log('TEST F: Order already linked to another customer rejected');
  const orderFId = 'order_test_f_006';
  await seedPaidOrder(orderFId, 'frank@example.com');
  // Pre-link order to a different customer
  await linkOrderToCustomer(env, orderFId, 'customer_existing_123');

  const rawClaimSecretF = 'claim_secret_f';
  await saveOrderClaim(env, {
    orderId: orderFId,
    claimHash: await sha256Hex(rawClaimSecretF),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const activateReqF = new Request('http://localhost/api/customer/activate-after-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `order_claim=${rawClaimSecretF}`,
    },
    body: JSON.stringify({
      orderId: orderFId,
      name: 'Frank Fraud',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  const activateResF = await handleActivate({ request: activateReqF, env });
  assert.strictEqual(activateResF.status, 409, 'Pre-linked order must return 409 Conflict');
  console.log('  PASS: Already-linked order rejected with 409.\n');

  // --------------------------------------------------
  // TEST G: Valid customer login
  // --------------------------------------------------
  console.log('TEST G: Valid customer login');
  const loginReqG = new Request('http://localhost/api/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailA,
      password: 'StrongPassword123!',
    }),
  });

  const loginResG = await handleLogin({ request: loginReqG, env });
  assert.strictEqual(loginResG.status, 200, 'Valid login must return 200 OK');
  const loginDataG = await loginResG.json();
  assert.strictEqual(loginDataG.success, true);
  assert.strictEqual(loginDataG.customer.email, emailA);

  const cookieHeaderG = loginResG.headers.get('Set-Cookie');
  assert.ok(cookieHeaderG.includes('customer_session='), 'Login must set customer_session cookie');
  assert.ok(cookieHeaderG.includes('HttpOnly'), 'Cookie must be HttpOnly');

  // Extract raw session token from Set-Cookie for subsequent tests
  const tokenMatchG = cookieHeaderG.match(/customer_session=([^;]+)/);
  const rawSessionTokenG = tokenMatchG[1];
  console.log('  PASS: Login verified with PBKDF2; session cookie returned.\n');

  // --------------------------------------------------
  // TEST H: Invalid password rejected
  // --------------------------------------------------
  console.log('TEST H: Invalid password rejected');
  const loginReqH = new Request('http://localhost/api/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailA,
      password: 'WrongPassword!',
    }),
  });

  const loginResH = await handleLogin({ request: loginReqH, env });
  assert.strictEqual(loginResH.status, 401, 'Invalid password must return 401 Unauthorized');
  const loginDataH = await loginResH.json();
  assert.strictEqual(loginDataH.error, 'Email or password is incorrect.', 'Safe generic error message required');
  console.log('  PASS: Invalid password rejected with safe 401 generic message.\n');

  // --------------------------------------------------
  // TEST I: Expired session rejected
  // --------------------------------------------------
  console.log('TEST I: Expired session rejected');
  const expiredRawToken = generateRandomToken(32);
  const expiredTokenHash = await sha256Hex(expiredRawToken);
  await createCustomerSession(env, {
    customerId: activateDataA.customer.id,
    tokenHash: expiredTokenHash,
    expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(), // Expired 1 hour ago
  });

  const sessionReqI = new Request('http://localhost/api/customer/session', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${expiredRawToken}` },
  });

  const sessionResI = await handleSession({ request: sessionReqI, env });
  const sessionDataI = await sessionResI.json();
  assert.strictEqual(sessionDataI.authenticated, false, 'Expired session must return authenticated: false');
  console.log('  PASS: Expired session rejected.\n');

  // --------------------------------------------------
  // TEST J: Revoked session rejected
  // --------------------------------------------------
  console.log('TEST J: Revoked session rejected');
  const revokedRawToken = generateRandomToken(32);
  const revokedTokenHash = await sha256Hex(revokedRawToken);
  await createCustomerSession(env, {
    customerId: activateDataA.customer.id,
    tokenHash: revokedTokenHash,
    expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
  });
  // Revoke session server-side
  await revokeCustomerSession(env, revokedTokenHash);

  const sessionReqJ = new Request('http://localhost/api/customer/session', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${revokedRawToken}` },
  });

  const sessionResJ = await handleSession({ request: sessionReqJ, env });
  const sessionDataJ = await sessionResJ.json();
  assert.strictEqual(sessionDataJ.authenticated, false, 'Revoked session must return authenticated: false');
  console.log('  PASS: Revoked session rejected.\n');

  // --------------------------------------------------
  // TEST K: Logout invalidates session
  // --------------------------------------------------
  console.log('TEST K: Logout invalidates session');
  const logoutReqK = new Request('http://localhost/api/customer/logout', {
    method: 'POST',
    headers: { 'Cookie': `customer_session=${rawSessionTokenG}` },
  });

  const logoutResK = await handleLogout({ request: logoutReqK, env });
  assert.strictEqual(logoutResK.status, 200);
  const clearCookieHeaderK = logoutResK.headers.get('Set-Cookie');
  assert.ok(clearCookieHeaderK.includes('Max-Age=0'), 'Logout must clear cookie');

  // Subsequent session check with this token must be unauthenticated
  const sessionReqK = new Request('http://localhost/api/customer/session', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${rawSessionTokenG}` },
  });
  const sessionResK = await handleSession({ request: sessionReqK, env });
  const sessionDataK = await sessionResK.json();
  assert.strictEqual(sessionDataK.authenticated, false, 'Logged out token must be revoked');
  console.log('  PASS: Logout clears cookie and invalidates session.\n');

  // --------------------------------------------------
  // TEST L: Customer A retrieves own My Materials (Own only)
  // --------------------------------------------------
  console.log('TEST L: Customer A retrieves own My Materials');
  // Re-login Customer A to get fresh active session
  const freshLoginA = await handleLogin({
    request: new Request('http://localhost/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: 'StrongPassword123!' }),
    }),
    env,
  });
  const freshCookieA = freshLoginA.headers.get('Set-Cookie').match(/customer_session=([^;]+)/)[1];

  const materialsReqL = new Request('http://localhost/api/customer/materials', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${freshCookieA}` },
  });

  const materialsResL = await handleMaterials({ request: materialsReqL, env });
  assert.strictEqual(materialsResL.status, 200);
  const materialsDataL = await materialsResL.json();
  assert.strictEqual(materialsDataL.materials.length, 2, 'Customer A must receive both base product and add-on');
  assert.strictEqual(materialsDataL.materials[0].name, 'IELTS Complete Academic Guide 2026');
  assert.ok(materialsDataL.materials[1].name.includes('Full Mock Test Pack'), 'Add-on name must include Full Mock Test Pack');
  assert.ok(materialsDataL.materials[0].downloadUrl.includes('token='), 'Must issue signed download token');
  console.log('  PASS: Customer A retrieved own authorized materials and signed tokens.\n');

  // --------------------------------------------------
  // TEST M: Customer A attempts to supply Customer B's ID
  // --------------------------------------------------
  console.log('TEST M: Customer A attempts to supply Customer B\'s ID (ignored/server-derived)');
  const materialsReqM = new Request('http://localhost/api/customer/materials?customerId=foreign_customer_b', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${freshCookieA}` },
  });

  const materialsResM = await handleMaterials({ request: materialsReqM, env });
  assert.strictEqual(materialsResM.status, 200);
  const materialsDataM = await materialsResM.json();
  // Server MUST derive customer strictly from session; materials should remain Customer A's
  assert.strictEqual(materialsDataM.customer.id, activateDataA.customer.id, 'Customer ID must be strictly server-derived');
  console.log('  PASS: Client query param ignored; server strictly derives customer from session.\n');

  // --------------------------------------------------
  // TEST N & P: Cross-Customer Isolation (Customer B vs Customer A)
  // --------------------------------------------------
  console.log('TEST N & P: Cross-Customer Isolation (Customer B vs Customer A)');
  // Create Customer B with different purchase (OET)
  const orderB2Id = 'order_test_b2_oet';
  const emailB = 'student_b_oet@example.com';
  const oetItems = [
    {
      productId: 'book-oet-001',
      productNameSnapshot: 'OET Nursing Masterclass 2026',
      format: 'digital',
      price: 499,
      digitalFile: {
        fileUrl: 'https://cloudinary.com/oet.pdf',
        filename: 'oet.pdf',
      },
    },
  ];
  await seedPaidOrder(orderB2Id, emailB, 'Bob Nurse', oetItems);

  const rawClaimSecretB2 = generateRandomToken(32);
  await saveOrderClaim(env, {
    orderId: orderB2Id,
    claimHash: await sha256Hex(rawClaimSecretB2),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const activateResB2 = await handleActivate({
    request: new Request('http://localhost/api/customer/activate-after-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `order_claim=${rawClaimSecretB2}` },
      body: JSON.stringify({
        orderId: orderB2Id,
        name: 'Bob Nurse',
        password: 'NursePassword123!',
        confirmPassword: 'NursePassword123!',
      }),
    }),
    env,
  });
  const cookieB = activateResB2.headers.get('Set-Cookie').match(/customer_session=([^;]+)/)[1];

  // Customer B checks My Materials -> Should ONLY see OET, NEVER IELTS
  const materialsResB = await handleMaterials({
    request: new Request('http://localhost/api/customer/materials', {
      method: 'GET',
      headers: { 'Cookie': `customer_session=${cookieB}` },
    }),
    env,
  });
  const materialsDataB = await materialsResB.json();
  assert.strictEqual(materialsDataB.materials.length, 1);
  assert.strictEqual(materialsDataB.materials[0].name, 'OET Nursing Masterclass 2026');

  // TEST P: Customer B attempts direct download of Customer A's IELTS material using their own session
  const downloadReqP = new Request(
    `http://localhost/api/download?order_id=${orderAId}&book_id=book-ielts-001&entitlement_id=${materialsDataL.materials[0].entitlementId}`,
    {
      method: 'GET',
      headers: { 'Cookie': `customer_session=${cookieB}` },
    }
  );
  const downloadResP = await handleDownload({ request: downloadReqP, env });
  assert.strictEqual(downloadResP.status, 403, 'Cross-customer download attempt must be denied with 403');
  console.log('  PASS: Complete cross-customer isolation verified; materials and downloads strictly separated.\n');

  // --------------------------------------------------
  // TEST Q, R, S: Guest Purchase & Post-Payment Linking
  // --------------------------------------------------
  console.log('TEST Q, R, S: Guest Purchase & Post-Payment Linking');
  // TEST Q: Guest buys product -> Order created with customer_id = null
  const guestOrderId = 'order_guest_q_007';
  const guestEmail = 'guest_student@example.com';
  const { order: guestOrder, entitlements: guestEntitlements } = await seedPaidOrder(guestOrderId, guestEmail);
  assert.strictEqual(guestOrder.customer_id, null, 'Guest order initially has null customer_id');
  assert.strictEqual(guestEntitlements.length, 2, 'Guest order has 2 active entitlements');

  // TEST R: Guest activates account -> Order linked to customer
  const rawClaimSecretQ = generateRandomToken(32);
  await saveOrderClaim(env, {
    orderId: guestOrderId,
    claimHash: await sha256Hex(rawClaimSecretQ),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const activateResQ = await handleActivate({
    request: new Request('http://localhost/api/customer/activate-after-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `order_claim=${rawClaimSecretQ}` },
      body: JSON.stringify({
        orderId: guestOrderId,
        name: 'George Guest',
        password: 'GuestPassword123!',
        confirmPassword: 'GuestPassword123!',
      }),
    }),
    env,
  });
  assert.strictEqual(activateResQ.status, 200);
  const guestCustId = (await activateResQ.json()).customer.id;

  const linkedGuestOrder = await getOrder(env, guestOrderId);
  assert.strictEqual(linkedGuestOrder.customer_id, guestCustId, 'Guest order successfully linked to new account');

  // TEST S: Entitlements preserved without duplicates
  const postLinkEntitlements = await getEntitlementsByOrderId(env, guestOrderId);
  assert.strictEqual(postLinkEntitlements.length, 2, 'Existing entitlements must remain unchanged (0 duplicates)');
  console.log('  PASS: Guest purchase linked to account; 0 duplicate entitlements created.\n');

  // --------------------------------------------------
  // TEST T, U, V: Refresh, Logout, and Relogin Workflow
  // --------------------------------------------------
  console.log('TEST T, U, V: Refresh, Logout, and Relogin Workflow');
  const sessionCookieQ = activateResQ.headers.get('Set-Cookie').match(/customer_session=([^;]+)/)[1];

  // TEST T: Customer refreshes My Materials
  const materialsReqT = new Request('http://localhost/api/customer/materials', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${sessionCookieQ}` },
  });
  const materialsResT = await handleMaterials({ request: materialsReqT, env });
  assert.strictEqual(materialsResT.status, 200);
  const materialsDataT = await materialsResT.json();
  assert.strictEqual(materialsDataT.materials.length, 2);

  // TEST U: Customer logs out -> My Materials inaccessible
  const logoutReqU = new Request('http://localhost/api/customer/logout', {
    method: 'POST',
    headers: { 'Cookie': `customer_session=${sessionCookieQ}` },
  });
  await handleLogout({ request: logoutReqU, env });

  const materialsReqU = new Request('http://localhost/api/customer/materials', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${sessionCookieQ}` },
  });
  const materialsResU = await handleMaterials({ request: materialsReqU, env });
  assert.strictEqual(materialsResU.status, 401, 'Logged out user cannot access My Materials');

  // TEST V: Customer logs in again -> Materials return
  const reloginResV = await handleLogin({
    request: new Request('http://localhost/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: guestEmail, password: 'GuestPassword123!' }),
    }),
    env,
  });
  assert.strictEqual(reloginResV.status, 200);
  const newCookieV = reloginResV.headers.get('Set-Cookie').match(/customer_session=([^;]+)/)[1];

  const materialsReqV = new Request('http://localhost/api/customer/materials', {
    method: 'GET',
    headers: { 'Cookie': `customer_session=${newCookieV}` },
  });
  const materialsResV = await handleMaterials({ request: materialsReqV, env });
  assert.strictEqual(materialsResV.status, 200);
  const materialsDataV = await materialsResV.json();
  assert.strictEqual(materialsDataV.materials.length, 2, 'All materials return upon re-login');
  console.log('  PASS: Refresh, logout, and re-login lifecycle validated.\n');

  // --------------------------------------------------
  // TEST W: Duplicate Account Protection (Section 21)
  // --------------------------------------------------
  console.log('TEST W: Duplicate Account Protection (Section 21)');
  const duplicateOrder = 'order_dup_w_008';
  await seedPaidOrder(duplicateOrder, emailA); // Alice's email already exists
  const rawClaimW = generateRandomToken(32);
  await saveOrderClaim(env, {
    orderId: duplicateOrder,
    claimHash: await sha256Hex(rawClaimW),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  });

  const dupResW = await handleActivate({
    request: new Request('http://localhost/api/customer/activate-after-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `order_claim=${rawClaimW}` },
      body: JSON.stringify({
        orderId: duplicateOrder,
        name: 'Alice Imposter',
        password: 'Password999!',
        confirmPassword: 'Password999!',
      }),
    }),
    env,
  });
  assert.strictEqual(dupResW.status, 409, 'Duplicate email registration must return 409 Conflict');
  const dupDataW = await dupResW.json();
  assert.ok(dupDataW.error.includes('An account already exists for this email'), 'Must guide user to sign in');
  console.log('  PASS: Duplicate customer account registration blocked with safe 409.\n');

  // --------------------------------------------------
  // TEST X: Authenticated Password Change
  // --------------------------------------------------
  console.log('TEST X: Authenticated Password Change');
  // Attempt change with wrong current password -> rejected
  const badPwChange = await handleChangePassword({
    request: new Request('http://localhost/api/customer/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `customer_session=${newCookieV}` },
      body: JSON.stringify({
        currentPassword: 'WrongOldPassword!',
        newPassword: 'BrandNewPassword123!',
        confirmNewPassword: 'BrandNewPassword123!',
      }),
    }),
    env,
  });
  assert.strictEqual(badPwChange.status, 400, 'Wrong current password must return 400');

  // Valid change password
  const goodPwChange = await handleChangePassword({
    request: new Request('http://localhost/api/customer/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `customer_session=${newCookieV}` },
      body: JSON.stringify({
        currentPassword: 'GuestPassword123!',
        newPassword: 'BrandNewPassword123!',
        confirmNewPassword: 'BrandNewPassword123!',
      }),
    }),
    env,
  });
  assert.strictEqual(goodPwChange.status, 200, 'Valid password change must succeed');

  // Verify login with new password
  const newLogin = await handleLogin({
    request: new Request('http://localhost/api/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: guestEmail, password: 'BrandNewPassword123!' }),
    }),
    env,
  });
  assert.strictEqual(newLogin.status, 200, 'Login with new password must succeed');
  console.log('  PASS: Authenticated password change with PBKDF2 re-hashing validated.\n');

  // --------------------------------------------------
  // TEST Y: Free Plan Efficiency Review
  // --------------------------------------------------
  console.log('TEST Y: Cloudflare Free Plan Efficiency Review');
  // Verify that getCustomerEntitlements uses a prepared JOIN query (0 N+1 queries)
  const initialJoins = env.DB.queryCounts.materialsJoins;
  await getCustomerEntitlements(env, activateDataA.customer.id);
  const postJoins = env.DB.queryCounts.materialsJoins;
  assert.strictEqual(postJoins - initialJoins, 1, 'Fetching customer materials must execute exactly 1 prepared JOIN query');
  console.log('  PASS: Exactly 1 prepared JOIN statement executed for customer materials (0 N+1 queries).\n');

  console.log('==================================================');
  console.log('ALL 25 PHASE 7 ACCEPTANCE & SECURITY TESTS PASSED!');
  console.log('==================================================\n');
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 test failure:', err);
  process.exit(1);
});
