// scripts/scan-secrets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const targets = ['dist', 'src', 'public'];
const badPatterns = [
  /api_secret/i,
  /cfsk_ma_prod_/i,
  /8156958052/,
  /ADMIN_PASSWORD_HASH\s*=\s*['"][a-f0-9]{32,}/i,
  /CLOUDINARY_API_SECRET/i
];

let leaks = 0;

function checkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      checkDir(full);
    } else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.html') || ent.name.endsWith('.ts') || ent.name.endsWith('.tsx') || ent.name.endsWith('.json'))) {
      const content = fs.readFileSync(full, 'utf8');
      for (const pat of badPatterns) {
        if (pat.test(content)) {
          console.error(`[LEAK DETECTED] in ${full}: matched ${pat}`);
          leaks++;
        }
      }
    }
  }
}

for (const t of targets) {
  checkDir(path.join(rootDir, t));
}

if (leaks > 0) {
  console.error(`FAIL: ${leaks} leak(s) detected.`);
  process.exit(1);
} else {
  console.log('SCAN PASSED: 0 secrets found across dist, src, and public.');
}
