import {
  computeYearlySavingsLabel,
  formatJpyPriceLabel,
} from '@/lib/pricing-format';

describe('pricing-format', () => {
  test('formatJpyPriceLabel: 月額ラベル', () => {
    expect(formatJpyPriceLabel(980, 'monthly')).toBe('¥980/月');
  });

  test('formatJpyPriceLabel: 年額ラベル', () => {
    expect(formatJpyPriceLabel(9800, 'yearly')).toBe('¥9,800/年');
  });

  test('computeYearlySavingsLabel: 2ヶ月分お得', () => {
    expect(computeYearlySavingsLabel(980, 9800)).toBe('年額で約2ヶ月分お得');
  });

  test('computeYearlySavingsLabel: お得なしは undefined', () => {
    expect(computeYearlySavingsLabel(980, 980 * 12)).toBeUndefined();
    expect(computeYearlySavingsLabel(0, 1000)).toBeUndefined();
  });
});
