import assert from 'assert';
import { DEFAULT_CATALOG_BANNER } from '../src/data/catalogBanner.ts';

console.log('Testing Catalog Banner Customization & Defaults...');

// 1. Check default catalog banner structure
assert.strictEqual(typeof DEFAULT_CATALOG_BANNER, 'object', 'DEFAULT_CATALOG_BANNER must be an object');
assert.strictEqual(DEFAULT_CATALOG_BANNER.title, 'Complete Exam Study Materials', 'Default title must match');
assert.strictEqual(DEFAULT_CATALOG_BANNER.titleColor, '#ffffff', 'Default titleColor must be white');
assert.strictEqual(DEFAULT_CATALOG_BANNER.subtitleColor, '#cbd5e1', 'Default subtitleColor must be slate light');
assert.strictEqual(Array.isArray(DEFAULT_CATALOG_BANNER.featurePills), true, 'featurePills must be an array');
assert.strictEqual(DEFAULT_CATALOG_BANNER.featurePills.length, 4, 'featurePills should have 4 default badges');

console.log('  ✓ DEFAULT_CATALOG_BANNER passed validation.');

// 2. Test customization merging
const customBanner = {
  ...DEFAULT_CATALOG_BANNER,
  desktopBgImage: 'https://res.cloudinary.com/test/desktop-hero.jpg',
  mobileBgImage: 'https://res.cloudinary.com/test/mobile-hero.jpg',
  titleColor: '#38bdf8',
  subtitleColor: '#bae6fd',
  overlayOpacity: 70,
};

assert.strictEqual(customBanner.desktopBgImage, 'https://res.cloudinary.com/test/desktop-hero.jpg');
assert.strictEqual(customBanner.mobileBgImage, 'https://res.cloudinary.com/test/mobile-hero.jpg');
assert.strictEqual(customBanner.titleColor, '#38bdf8');
assert.strictEqual(customBanner.subtitleColor, '#bae6fd');
assert.strictEqual(customBanner.overlayOpacity, 70);

console.log('  ✓ Custom banner attributes verified.');
console.log('ALL CATALOG BANNER TESTS PASSED SUCCESSFULLY!');
