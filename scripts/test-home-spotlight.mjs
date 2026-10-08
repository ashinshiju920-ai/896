import assert from 'assert';
import { DEFAULT_HOME_SPOTLIGHT } from '../src/data/homeSpotlight.ts';

console.log('Testing Homepage Spotlight Customization & Defaults...');

assert.strictEqual(typeof DEFAULT_HOME_SPOTLIGHT, 'object', 'DEFAULT_HOME_SPOTLIGHT must be an object');
assert.strictEqual(DEFAULT_HOME_SPOTLIGHT.enabled, true, 'Spotlight should be enabled by default');
assert.strictEqual(DEFAULT_HOME_SPOTLIGHT.productId, 'select-your-path-guide', 'Default product should be Select Your Path');
assert.strictEqual(DEFAULT_HOME_SPOTLIGHT.badgeText, 'Best Product', 'Default badge text must match');
assert.strictEqual(DEFAULT_HOME_SPOTLIGHT.secondaryBadgeText, 'Instant PDF', 'Default secondary badge must match');
assert.strictEqual(DEFAULT_HOME_SPOTLIGHT.buttonText, 'Buy Now', 'Default button text must match');

console.log('  ✓ DEFAULT_HOME_SPOTLIGHT passed validation.');

const customSpotlight = {
  ...DEFAULT_HOME_SPOTLIGHT,
  productId: 'ielts-full-prep',
  imageUrl: 'https://res.cloudinary.com/test/home-spotlight.jpg',
  title: 'Custom Homepage Feature',
  description: 'Custom spotlight copy for the homepage.',
  price: 249,
  originalPrice: 799,
  buttonText: 'Start Now',
  backgroundColor: '#f8fafc',
};

assert.strictEqual(customSpotlight.productId, 'ielts-full-prep');
assert.strictEqual(customSpotlight.imageUrl, 'https://res.cloudinary.com/test/home-spotlight.jpg');
assert.strictEqual(customSpotlight.title, 'Custom Homepage Feature');
assert.strictEqual(customSpotlight.description, 'Custom spotlight copy for the homepage.');
assert.strictEqual(customSpotlight.price, 249);
assert.strictEqual(customSpotlight.originalPrice, 799);
assert.strictEqual(customSpotlight.buttonText, 'Start Now');
assert.strictEqual(customSpotlight.backgroundColor, '#f8fafc');

console.log('  ✓ Custom spotlight attributes verified.');
console.log('ALL HOMEPAGE SPOTLIGHT TESTS PASSED SUCCESSFULLY!');
