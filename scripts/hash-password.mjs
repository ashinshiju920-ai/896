#!/usr/bin/env node
/**
 * scripts/hash-password.mjs
 * 
 * Secure PBKDF2 Password Hasher for Cloudflare Pages Admin Authentication.
 * Produces output byte-for-byte identical to Web Crypto deriveBits (PBKDF2 SHA-256, 100,000 iterations).
 * 
 * Usage:
 *   node scripts/hash-password.mjs "YourSecurePassword"
 *   OR run interactively without arguments:
 *   node scripts/hash-password.mjs
 */

import crypto from 'node:crypto';
import readline from 'node:readline';

function computePbkdf2(password, saltHex) {
  const saltBytes = Buffer.from(saltHex, 'hex');
  // 100,000 iterations, 32 bytes (256 bits), SHA-256
  const hashBuffer = crypto.pbkdf2Sync(password, saltBytes, 100000, 32, 'sha256');
  return hashBuffer.toString('hex');
}

function processPassword(password) {
  if (!password || !password.trim()) {
    console.error('Error: Password cannot be empty.');
    process.exit(1);
  }

  // 16 bytes (32 hex characters) salt
  const saltHex = crypto.randomBytes(16).toString('hex');
  // 32 bytes (64 hex characters) PBKDF2 hash
  const hashHex = computePbkdf2(password.trim(), saltHex);
  // 32 bytes (64 hex characters) session signing secret
  const sessionSecretHex = crypto.randomBytes(32).toString('hex');

  console.log('\n============================================================');
  console.log('✓ ADMIN AUTHENTICATION CREDENTIALS GENERATED SUCCESSFULLY');
  console.log('============================================================');
  console.log('\nAdd these variables to your Cloudflare Pages Settings:');
  console.log('(Cloudflare Dashboard -> Workers & Pages -> Your Project -> Settings -> Variables and Secrets)\n');
  console.log(`ADMIN_PASSWORD_SALT="${saltHex}"`);
  console.log(`ADMIN_PASSWORD_HASH="${hashHex}"`);
  console.log(`ADMIN_SESSION_SECRET="${sessionSecretHex}"`);
  console.log('\n============================================================\n');
}

const argPassword = process.argv[2];
if (argPassword) {
  processPassword(argPassword);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter password to hash: ', (password) => {
    rl.close();
    processPassword(password);
  });
}
