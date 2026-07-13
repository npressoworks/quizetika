process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';

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
  fetchPlanPricesFromStripe,
} from '@/services/billing-prices';

describe('billing-prices service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('月額・年額の両方取得成功', async () => {
    mockRetrieve.mockImplementation(async (id: string) => {
      if (id === 'price_player_monthly_test') {
        return { currency: 'jpy', unit_amount: 480 };
      }
      if (id === 'price_player_yearly_test') {
        return { currency: 'jpy', unit_amount: 4800 };
      }
      if (id === 'price_creator_monthly_test') {
        return { currency: 'jpy', unit_amount: 980 };
      }
      if (id === 'price_creator_yearly_test') {
        return { currency: 'jpy', unit_amount: 9800 };
      }
      throw new Error('unknown');
    });

    const result = await fetchPlanPricesFromStripe();
    expect(result.player.monthly).toEqual({
      amount: 480,
      currency: 'jpy',
      label: '¥480/月',
    });
    expect(result.player.yearly).toEqual({
      amount: 4800,
      currency: 'jpy',
      label: '¥4,800/年',
    });
    expect(result.player.savingsLabel).toBe('年額で約2ヶ月分お得');

    expect(result.creator.monthly).toEqual({
      amount: 980,
      currency: 'jpy',
      label: '¥980/月',
    });
    expect(result.creator.yearly).toEqual({
      amount: 9800,
      currency: 'jpy',
      label: '¥9,800/年',
    });
    expect(result.creator.savingsLabel).toBe('年額で約2ヶ月分お得');
  });

  test('一方の Price 取得失敗時はエラー', async () => {
    mockRetrieve.mockImplementation(async (id: string) => {
      if (id === 'price_player_monthly_test') {
        return { currency: 'jpy', unit_amount: 480 };
      }
      throw new Error('stripe down');
    });

    await expect(fetchPlanPricesFromStripe()).rejects.toBeInstanceOf(BillingPricesFetchError);
  });

  test('JPY 以外の currency はエラー', async () => {
    mockRetrieve.mockResolvedValue({ currency: 'usd', unit_amount: 999 });

    await expect(fetchPlanPricesFromStripe()).rejects.toBeInstanceOf(BillingPricesFetchError);
  });
});

