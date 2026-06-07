import {
  BillingClientError,
  getFirebaseIdToken,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
} from '@/lib/billing-client';

const mockGetIdToken = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/lib/firebase/config', () => ({
  auth: {
    currentUser: null as { getIdToken: () => Promise<string> } | null,
  },
}));

describe('billing-client', () => {
  const { auth } = jest.requireMock('@/lib/firebase/config') as {
    auth: { currentUser: { getIdToken: () => Promise<string> } | null };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    auth.currentUser = {
      getIdToken: mockGetIdToken,
    };
    mockGetIdToken.mockResolvedValue('token-abc');
  });

  test('getFirebaseIdToken: 未ログイン時は null', async () => {
    auth.currentUser = null;
    await expect(getFirebaseIdToken()).resolves.toBeNull();
  });

  test('startCheckoutSession: 成功時に sessionUrl を返す', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sessionUrl: 'https://checkout.stripe.com/test' }),
    });

    const result = await startCheckoutSession('monthly');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/billing/checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-abc',
        }),
        body: JSON.stringify({ priceInterval: 'monthly' }),
      })
    );
  });

  test('startCheckoutSession: 401 を unauthorized にマップ', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' }),
    });

    await expect(startCheckoutSession('yearly')).rejects.toMatchObject({
      name: 'BillingClientError',
      apiError: {
        code: 'unauthorized',
        message: 'ログインが必要です',
        httpStatus: 401,
      },
    });
  });

  test('startCheckoutSession: 409 を already-subscribed にマップ', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'already-subscribed',
        message: 'すでに有料プランに契約中です。',
      }),
    });

    await expect(startCheckoutSession('monthly')).rejects.toMatchObject({
      apiError: {
        code: 'already-subscribed',
        httpStatus: 409,
      },
    });
  });

  test('startPortalSession: 成功時に sessionUrl を返す', async () => {
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

  test('redirectToExternalUrl: 非 https URL は拒否', () => {
    expect(() => redirectToExternalUrl('http://evil.example')).toThrow(BillingClientError);
    expect(() => redirectToExternalUrl('javascript:alert(1)')).toThrow(BillingClientError);
  });
});
