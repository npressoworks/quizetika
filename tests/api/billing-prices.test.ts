import { GET } from '@/app/api/billing/prices/route';

const mockFetchPlanPrices = jest.fn();

jest.mock('@/services/billing-prices', () => ({
  fetchPlanPricesFromStripe: (...args: unknown[]) => mockFetchPlanPrices(...args),
  BillingPricesFetchError: class BillingPricesFetchError extends Error {
    name = 'BillingPricesFetchError';
  },
}));

describe('GET /api/billing/prices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('成功時に player / creator の価格を返す', async () => {
    mockFetchPlanPrices.mockResolvedValue({
      player: {
        monthly: { amount: 480, currency: 'jpy', label: '¥480/月' },
        yearly: { amount: 4800, currency: 'jpy', label: '¥4,800/年' },
        savingsLabel: '年額で約2ヶ月分お得',
      },
      creator: {
        monthly: { amount: 980, currency: 'jpy', label: '¥980/月' },
        yearly: { amount: 9800, currency: 'jpy', label: '¥9,800/年' },
        savingsLabel: '年額で約2ヶ月分お得',
      },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.player.monthly.label).toBe('¥480/月');
    expect(body.creator.monthly.label).toBe('¥980/月');
    expect(body.player.savingsLabel).toBe('年額で約2ヶ月分お得');
  });

  test('Stripe 失敗時は 500', async () => {
    const { BillingPricesFetchError } = jest.requireMock('@/services/billing-prices');
    mockFetchPlanPrices.mockRejectedValue(new BillingPricesFetchError('fail'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

