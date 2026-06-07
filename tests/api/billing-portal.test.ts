import { POST } from '@/app/api/billing/portal-session/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockCreatePortal = jest.fn();

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/subscription', () => ({
  createPortalSession: (...args: unknown[]) => mockCreatePortal(...args),
  NoActiveSubscriptionError: class NoActiveSubscriptionError extends Error {
    name = 'NoActiveSubscriptionError';
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
          data: () => ({ isBanned: false }),
        }),
      }),
    }),
  }),
}));

describe('POST /api/billing/portal-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePortal.mockResolvedValue({ sessionUrl: 'https://portal.test' });
  });

  it('未認証は 401', async () => {
    mockVerify.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/billing/portal-session', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('active pro ユーザーは Portal URL を取得できる', async () => {
    mockVerify.mockResolvedValue('uid-pro');
    const req = new NextRequest('http://localhost/api/billing/portal-session', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessionUrl).toBe('https://portal.test');
  });

  it('free ユーザーは 404', async () => {
    mockVerify.mockResolvedValue('uid-free');
    const { NoActiveSubscriptionError } = jest.requireMock('@/services/subscription');
    mockCreatePortal.mockRejectedValue(new NoActiveSubscriptionError());
    const req = new NextRequest('http://localhost/api/billing/portal-session', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
