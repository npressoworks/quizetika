process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';

const mockRetrieve = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    prices: {
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    },
  }),
}));

import {
  BillingPricesFetchError,
  fetchProPricesFromStripe,
} from '@/services/billing-prices';

describe('billing-prices service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('月額・年額の両方取得成功', async () => {
    mockRetrieve.mockImplementation(async (id: string) => {
      if (id === 'price_monthly_test') {
        return { currency: 'jpy', unit_amount: 980 };
      }
      if (id === 'price_yearly_test') {
        return { currency: 'jpy', unit_amount: 9800 };
      }
      throw new Error('unknown');
    });

    const result = await fetchProPricesFromStripe();
    expect(result.monthly).toEqual({
      amount: 980,
      currency: 'jpy',
      label: '¥980/月',
    });
    expect(result.yearly).toEqual({
      amount: 9800,
      currency: 'jpy',
      label: '¥9,800/年',
    });
    expect(result.savingsLabel).toBe('年額で約2ヶ月分お得');
  });

  test('一方の Price 取得失敗時はエラー', async () => {
    mockRetrieve.mockImplementation(async (id: string) => {
      if (id === 'price_monthly_test') {
        return { currency: 'jpy', unit_amount: 980 };
      }
      throw new Error('stripe down');
    });

    await expect(fetchProPricesFromStripe()).rejects.toBeInstanceOf(BillingPricesFetchError);
  });

  test('JPY 以外の currency はエラー', async () => {
    mockRetrieve.mockResolvedValue({ currency: 'usd', unit_amount: 999 });

    await expect(fetchProPricesFromStripe()).rejects.toBeInstanceOf(BillingPricesFetchError);
  });
});
