import {
  BillingClientError,
  fetchPlanPrices,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
  changePlan,
} from '@/lib/billing-client';

const mockGetSupabaseAccessToken = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/lib/supabase/auth', () => ({
  getSupabaseAccessToken: (...args: unknown[]) => mockGetSupabaseAccessToken(...args),
}));

describe('billing-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockGetSupabaseAccessToken.mockResolvedValue('token-abc');
  });

  describe('startCheckoutSession', () => {
    test('未ログイン時は unauthorized エラー', async () => {
      mockGetSupabaseAccessToken.mockResolvedValue(null);

      await expect(startCheckoutSession('creator', 'monthly')).rejects.toMatchObject({
        apiError: {
          code: 'unauthorized',
          message: 'ログインが必要です',
        },
      });
    });

    test('成功時に sessionUrl を返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sessionUrl: 'https://checkout.stripe.com/test' }),
      });

      const result = await startCheckoutSession('creator', 'monthly');
      expect(result.sessionUrl).toBe('https://checkout.stripe.com/test');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/billing/checkout-session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-abc',
          }),
          body: JSON.stringify({ priceInterval: 'monthly', plan: 'creator' }),
        })
      );
    });

    test('401 を unauthorized にマップ', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' }),
      });

      await expect(startCheckoutSession('player', 'yearly')).rejects.toMatchObject({
        name: 'BillingClientError',
        apiError: {
          code: 'unauthorized',
          message: 'ログインが必要です',
          httpStatus: 401,
        },
      });
    });

    test('409 を already-subscribed にマップ', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'already-subscribed',
          message: 'すでに有料プランに契約中です。',
        }),
      });

      await expect(startCheckoutSession('creator', 'monthly')).rejects.toMatchObject({
        apiError: {
          code: 'already-subscribed',
          httpStatus: 409,
        },
      });
    });
  });

  describe('startPortalSession', () => {
    test('成功時に sessionUrl を返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sessionUrl: 'https://billing.stripe.com/test' }),
      });

      const result = await startPortalSession();
      expect(result.sessionUrl).toBe('https://billing.stripe.com/test');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/billing/portal-session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-abc',
          }),
        })
      );
    });
  });

  describe('redirectToExternalUrl', () => {
    test('非 https URL は拒否', () => {
      expect(() => redirectToExternalUrl('http://evil.example')).toThrow(BillingClientError);
      expect(() => redirectToExternalUrl('javascript:alert(1)')).toThrow(BillingClientError);
    });
  });

  describe('fetchPlanPrices', () => {
    test('成功時に価格クォートを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          player: {
            monthly: { amount: 500, currency: 'jpy', label: '¥500/月' },
            yearly: { amount: 5000, currency: 'jpy', label: '¥5,000/年' },
            savingsLabel: '年額で約2ヶ月分お得',
          },
          creator: {
            monthly: { amount: 980, currency: 'jpy', label: '¥980/月' },
            yearly: { amount: 9800, currency: 'jpy', label: '¥9,800/年' },
            savingsLabel: '年額で約2ヶ月分お得',
          },
        }),
      });

      const result = await fetchPlanPrices();
      expect(result.player.monthly.label).toBe('¥500/月');
      expect(result.creator.yearly.label).toBe('¥9,800/年');
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/prices');
    });

    test('500 を unknown エラーにマップ', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal-error', message: '価格情報の取得に失敗しました。' }),
      });

      await expect(fetchPlanPrices()).rejects.toMatchObject({
        apiError: {
          code: 'unknown',
          httpStatus: 500,
        },
      });
    });

    test('ネットワーク障害', async () => {
      mockFetch.mockRejectedValue(new Error('network'));

      await expect(fetchPlanPrices()).rejects.toMatchObject({
        apiError: {
          code: 'network',
        },
      });
    });
  });

  describe('changePlan', () => {
    test('未ログイン時は unauthorized エラー', async () => {
      mockGetSupabaseAccessToken.mockResolvedValue(null);

      await expect(changePlan('creator')).rejects.toMatchObject({
        apiError: {
          code: 'unauthorized',
          message: 'ログインが必要です',
        },
      });
    });

    test('成功時に新 tier を返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ subscriptionTier: 'creator' }),
      });

      const result = await changePlan('creator');
      expect(result.subscriptionTier).toBe('creator');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/billing/change-plan',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-abc',
          }),
          body: JSON.stringify({ targetPlan: 'creator' }),
        })
      );
    });

    test('409 失敗時のマッピング', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'already-subscribed', message: 'すでに同じプランに契約中か、プラン変更できません。' }),
      });

      await expect(changePlan('player')).rejects.toMatchObject({
        apiError: {
          code: 'already-subscribed',
          httpStatus: 409,
        },
      });
    });
  });
});
