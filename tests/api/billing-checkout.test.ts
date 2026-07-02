import { POST } from '@/app/api/billing/checkout-session/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockCreateCheckout = jest.fn();

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/subscription', () => ({
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckout(...args),
  AlreadySubscribedError: class AlreadySubscribedError extends Error {
    name = 'AlreadySubscribedError';
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    name = 'UserNotFoundError';
  },
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ email: 'user@example.com', isBanned: false }),
        }),
      }),
    }),
  }),
}));

describe('POST /api/billing/checkout-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateCheckout.mockResolvedValue({ sessionUrl: 'https://checkout.test' });
  });

  it('未認証は 401', async () => {
    mockVerify.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceInterval: 'monthly' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('free ユーザーは sessionUrl を取得できる', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const req = new NextRequest('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceInterval: 'monthly' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessionUrl).toBe('https://checkout.test');
  });

  it('既存契約者は 409', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const { AlreadySubscribedError } = jest.requireMock('@/services/subscription');
    mockCreateCheckout.mockRejectedValue(new AlreadySubscribedError());
    const req = new NextRequest('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceInterval: 'yearly' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
