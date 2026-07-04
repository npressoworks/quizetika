import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseAccessToken: jest.fn(),
}));

jest.mock('@/services/seedInitialGenresAdmin', () => ({
  seedInitialGenresWithAdmin: jest.fn(),
}));

let usersRow: { moderation_tier?: string; role?: string } | null = null;

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: usersRow, error: null }),
        }),
      }),
    }),
  }),
}));

const mockExtractBearerToken = extractBearerToken as jest.MockedFunction<typeof extractBearerToken>;
const mockVerifyFirebaseIdToken = verifySupabaseAccessToken as jest.MockedFunction<
  typeof verifySupabaseAccessToken
>;
const { seedInitialGenresWithAdmin } = jest.requireMock('@/services/seedInitialGenresAdmin') as {
  seedInitialGenresWithAdmin: jest.Mock;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('@/app/api/admin/seed-genres/route') as typeof import('@/app/api/admin/seed-genres/route');

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/seed-genres', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });
}

describe('POST /api/admin/seed-genres', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractBearerToken.mockReturnValue('test-token');
    seedInitialGenresWithAdmin.mockResolvedValue({ added: 3, updated: 2 });
    usersRow = null;
  });

  test('トークンが無効な場合は 401 を返すこと', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue(null);

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  test('管理者以外は 403 を返すこと', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue('user-1');
    usersRow = { moderation_tier: 'senior_moderator' };

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('管理者は 200 と投入件数を返すこと', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue('admin-1');
    usersRow = { moderation_tier: 'admin' };

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.added).toBe(3);
    expect(body.updated).toBe(2);
    expect(seedInitialGenresWithAdmin).toHaveBeenCalledTimes(1);
  });

  test('role が admin のユーザーも 200 を返すこと', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue('admin-2');
    usersRow = { moderation_tier: 'moderator', role: 'admin' };

    const res = await POST(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(seedInitialGenresWithAdmin).toHaveBeenCalledTimes(1);
  });
});
