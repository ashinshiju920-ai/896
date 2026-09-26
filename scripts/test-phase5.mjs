// scripts/test-phase5.mjs
// Phase 5 Edge Hardening & Security Header Verification Suite

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

import { isOriginAllowed, getCorsHeaders } from '../functions/utils/cors.js';
import { checkRateLimit } from '../functions/utils/rateLimit.js';

console.log('--- RUNNING PHASE 5 TEST SUITE ---');

// 1. CORS Origin Matching & Credentials
console.log('\n[Group 1] CORS Domain Whitelisting & Header Sanitization');
{
  const allowedTestCases = [
    'https://portal.xylemlearning.online',
    'https://xylemlearning.online',
    'https://my-preview-branch.pages.dev',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:8788',
  ];

  for (const origin of allowedTestCases) {
    assert.strictEqual(
      isOriginAllowed(origin, {}),
      true,
      `Origin should be allowed: ${origin}`
    );

    const mockReq = { headers: new Map([['Origin', origin]]) };
    mockReq.headers.get = (k) => (k.toLowerCase() === 'origin' ? origin : null);
    const headers = getCorsHeaders(mockReq, {});
    assert.strictEqual(headers['Access-Control-Allow-Origin'], origin);
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], 'true');
    assert.strictEqual(headers['Vary'], 'Origin');
  }

  // Reject malicious domains
  const disallowed = [
    'https://evil-site.com',
    'https://phishing-xylem.com',
    'http://pages.dev.attacker.com',
    'https://fake-xylemlearning.online.attacker.org',
  ];

  for (const origin of disallowed) {
    assert.strictEqual(
      isOriginAllowed(origin, {}),
      false,
      `Malicious origin should be rejected: ${origin}`
    );

    const mockReq = { headers: new Map([['Origin', origin]]) };
    mockReq.headers.get = (k) => (k.toLowerCase() === 'origin' ? origin : null);
    const headers = getCorsHeaders(mockReq, {});
    // Should NOT reflect the evil origin
    assert.notStrictEqual(headers['Access-Control-Allow-Origin'], origin);
  }

  // Env override works
  assert.strictEqual(
    isOriginAllowed('https://custom.client-domain.com', { ALLOWED_ORIGIN: 'https://custom.client-domain.com' }),
    true
  );

  console.log('✓ Group 1 Passed: CORS whitelist, credentials, and reflection verified.');
}

// 2. Sliding Window KV Rate Limiter
console.log('\n[Group 2] Sliding Window Rate Limiter');
async function testRateLimit() {
  const mockStorage = new Map();
  const mockKV = {
    get: async (k) => mockStorage.get(k) || null,
    put: async (k, v, opts) => mockStorage.set(k, v),
  };
  const env = { PRODUCTS_KV: mockKV };

  const clientIp = '203.0.113.42';
  const key = `test-order:${clientIp}`;
  const maxRequests = 3;
  const windowSeconds = 60;

  // Requests 1, 2, 3 should succeed
  for (let i = 1; i <= 3; i++) {
    const res = await checkRateLimit(env, key, maxRequests, windowSeconds);
    assert.strictEqual(res.allowed, true, `Request ${i} should be allowed`);
    assert.strictEqual(res.remaining, maxRequests - i);
  }

  // Request 4 should be rejected
  const blockedRes = await checkRateLimit(env, key, maxRequests, windowSeconds);
  assert.strictEqual(blockedRes.allowed, false, 'Request 4 should be rate limited');
  assert.strictEqual(blockedRes.remaining, 0);
  assert.ok(blockedRes.resetSeconds > 0, 'Reset timestamp should be positive');

  console.log('✓ Group 2 Passed: Sliding window rate limiter throttles excessive calls.');
}
await testRateLimit();

// 3. Security Headers in public/_headers
console.log('\n[Group 3] Edge Security Headers & CSP in public/_headers');
{
  const headersPath = path.join(rootDir, 'public', '_headers');
  const content = fs.readFileSync(headersPath, 'utf8');

  // Must NOT contain wildcard CORS
  assert.ok(!content.includes('Access-Control-Allow-Origin: *'), 'Must not contain wildcard CORS in _headers');

  // Must contain HSTS
  assert.ok(content.includes('Strict-Transport-Security: max-age=31536000'), 'Must contain HSTS');

  // Must contain X-Frame-Options
  assert.ok(content.includes('X-Frame-Options: DENY'), 'Must contain clickjacking protection');

  // Must contain X-Content-Type-Options
  assert.ok(content.includes('X-Content-Type-Options: nosniff'), 'Must contain nosniff');

  // Must contain Referrer-Policy
  assert.ok(content.includes('Referrer-Policy: strict-origin-when-cross-origin'), 'Must contain Referrer-Policy');

  // CSP check: script-src must NOT contain 'unsafe-inline'
  const cspLine = content.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  assert.ok(cspLine, 'Content-Security-Policy must be present');
  const scriptSrcPart = cspLine.split(';').find((p) => p.trim().startsWith('script-src'));
  assert.ok(scriptSrcPart, 'script-src must be defined');
  assert.ok(!scriptSrcPart.includes("'unsafe-inline'"), "script-src must NOT contain 'unsafe-inline'");
  assert.ok(scriptSrcPart.includes('https://sdk.cashfree.com'), 'script-src must allow Cashfree SDK');

  console.log('✓ Group 3 Passed: public/_headers properly hardened without wildcard CORS or inline script allowance.');
}

// 4. Gitignore and Env Example hygiene
console.log('\n[Group 4] Environment & Configuration Hygiene');
{
  const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  assert.ok(gitignoreContent.includes('.dev.vars*'), '.gitignore must ignore .dev.vars*');
  assert.ok(gitignoreContent.includes('.wrangler/'), '.gitignore must ignore .wrangler/');

  const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  assert.ok(envExample.includes('CASHFREE_APP_ID='), '.env.example must specify CASHFREE_APP_ID');
  assert.ok(envExample.includes('CASHFREE_SECRET_KEY='), '.env.example must specify CASHFREE_SECRET_KEY');
  assert.ok(envExample.includes('CLOUDINARY_API_SECRET='), '.env.example must specify CLOUDINARY_API_SECRET');
  assert.ok(envExample.includes('ADMIN_PASSWORD_HASH='), '.env.example must specify ADMIN_PASSWORD_HASH');
  assert.ok(envExample.includes('ADMIN_SESSION_SECRET='), '.env.example must specify ADMIN_SESSION_SECRET');
  assert.ok(envExample.includes('PRODUCTS_KV'), '.env.example must document PRODUCTS_KV binding');
  assert.ok(envExample.includes('DB'), '.env.example must document DB binding');

  // Verify no live secrets are written in .env.example
  assert.ok(!envExample.includes('cfsk_ma_prod_'), 'No production secrets in .env.example');
  assert.ok(!envExample.includes('8156958052'), 'No phone numbers/personal secrets in .env.example');

  console.log('✓ Group 4 Passed: .gitignore and .env.example hygiene verified.');
}

console.log('\n=============================================');
console.log('ALL PHASE 5 HARDENING TESTS PASSED SUCCESSFULLY');
console.log('=============================================\n');
