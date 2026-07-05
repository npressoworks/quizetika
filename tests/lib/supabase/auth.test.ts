const mockGetSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  }),
}));

import { getSupabaseAccessToken, signOut } from '@/lib/supabase/auth';

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

describe('signOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('scope: local を指定してサインアウトすること（他デバイス・他ブラウザのセッションを巻き込んで失効させないため）', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
