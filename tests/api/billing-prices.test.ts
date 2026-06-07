import { GET } from '@/app/api/billing/prices/route';

const mockFetchProPrices = jest.fn();

jest.mock('@/services/billing-prices', () => ({
  fetchProPricesFromStripe: (...args: unknown[]) => mockFetchProPrices(...args),
  BillingPricesFetchError: class BillingPricesFetchError extends Error {
    name = 'BillingPricesFetchError';
  },
}));

describe('GET /api/billing/prices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('成功時に monthly/yearly を返す', async () => {
    mockFetchProPrices.mockResolvedValue({
      monthly: { amount: 980, currency: 'jpy', label: '¥980/月' },
      yearly: { amount: 9800, currency: 'jpy', label: '¥9,800/年' },
      savingsLabel: '年額で約2ヶ月分お得',
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.monthly.label).toBe('¥980/月');
    expect(body.yearly.label).toBe('¥9,800/年');
    expect(body.savingsLabel).toBe('年額で約2ヶ月分お得');
  });

  test('Stripe 失敗時は 500', async () => {
    const { BillingPricesFetchError } = jest.requireMock('@/services/billing-prices');
    mockFetchProPrices.mockRejectedValue(new BillingPricesFetchError('fail'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
