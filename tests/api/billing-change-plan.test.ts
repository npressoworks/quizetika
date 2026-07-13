import { POST } from '@/app/api/billing/change-plan/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockChangePlan = jest.fn();

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/subscription', () => ({
  changeSubscriptionPlan: (...args: unknown[]) => mockChangePlan(...args),
  NoActiveSubscriptionError: class NoActiveSubscriptionError extends Error {
    name = 'NoActiveSubscriptionError';
    constructor(msg = 'No active subscription') {
      super(msg);
    }
  },
  SamePlanError: class SamePlanError extends Error {
    name = 'SamePlanError';
    constructor(msg = 'Same plan') {
      super(msg);
    }
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    name = 'UserNotFoundError';
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { is_banned: false },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('POST /api/billing/change-plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未認証は 401', async () => {
    mockVerify.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ targetPlan: 'creator' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('無効な targetPlan は 400', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const req = new NextRequest('http://localhost/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ targetPlan: 'invalid' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('有料契約なしユーザーからの呼び出しは 403', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const { NoActiveSubscriptionError } = jest.requireMock('@/services/subscription');
    mockChangePlan.mockRejectedValue(new NoActiveSubscriptionError());

    const req = new NextRequest('http://localhost/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ targetPlan: 'creator' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('同一プランへの変更要求は 400', async () => {
    mockVerify.mockResolvedValue('uid-1');
    const { SamePlanError } = jest.requireMock('@/services/subscription');
    mockChangePlan.mockRejectedValue(new SamePlanError());

    const req = new NextRequest('http://localhost/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ targetPlan: 'creator' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('有効な player/creator 契約者からのプラン変更は 200', async () => {
    mockVerify.mockResolvedValue('uid-1');
    mockChangePlan.mockResolvedValue('creator');

    const req = new NextRequest('http://localhost/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ targetPlan: 'creator' }),
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.subscriptionTier).toBe('creator');
  });
});
