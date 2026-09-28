import { validateAndReconcileCart } from '../src/utils/pricing';
import { Book } from '../src/types';

const mockBook: Book = {
  id: 'ielts_01',
  title: 'IELTS Academic Masterclass',
  category: 'IELTS',
  disablePaperback: true,
  prices: {
    digital: { price: 199, originalPrice: 599 },
    physical: { price: 899, originalPrice: 1499 },
  },
  addons: [],
} as any;

const cartItem = {
  book: mockBook,
  format: 'physical' as const,
  quantity: 1,
  selectedAddonIds: [],
} as any;

const result = validateAndReconcileCart([cartItem], [mockBook]);
console.log('Format after reconciliation:', result.reconciledCart[0]?.format);
console.log('Price after reconciliation:', result.reconciledCart[0]?.price);
console.log('Modified items:', result.modifiedItems);

if (result.reconciledCart[0]?.format !== 'digital') {
  console.error('FAILED: expected format to be converted to digital');
  process.exit(1);
}

if (result.reconciledCart[0]?.price !== 199) {
  console.error('FAILED: expected price to be 199');
  process.exit(1);
}

console.log('ALL PAPERBACK RECONCILIATION TESTS PASSED!');
