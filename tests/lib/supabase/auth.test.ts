const mockGetSession = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

import { getSupabaseAccessToken } from '@/lib/supabase/auth';

describe('getSupabaseAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('セッションが存在する場合はアクセストークンを返す', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-xyz' } },
    });

    await expect(getSupabaseAccessToken()).resolves.toBe('token-xyz');
  });

  test('セッションが存在しない場合は null を返す', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(getSupabaseAccessToken()).resolves.toBeNull();
  });
});
