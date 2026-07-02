import { getFollowerUsers, getFollowingUsers } from '@/services/user';

// チェーン用のモックヘルパー
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    then: jest.fn((onFulfilled) => {
      return Promise.resolve(resolveValue).then(onFulfilled);
    }),
  };
  return chain;
};

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

function makeUserRow(id: string, displayName: string) {
  return {
    id,
    email: `${id}@example.com`,
    display_name: displayName,
    avatar_url: '',
    bio: '',
    followed_genres: [],
    badges: [],
    created_quizzes_count: 0,
    total_play_count: 0,
    followers_count: 0,
    following_count: 0,
    reputation_score: 0,
    moderation_tier: 'newcomer',
    reputation_history: [],
    last_reputation_calculated_at: null,
    total_failed_questions_count: 0,
    delete_status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('user connections service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getFollowerUsers は DB からフォロワーを解決する', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'follows') {
        const chain = createChainMock({
          data: [{ follower_id: 'follower-1', following_id: 'target-1' }],
          error: null,
        });
        return chain;
      }
      if (table === 'users') {
        const chain = createChainMock({
          data: [makeUserRow('follower-1', 'フォロワーA')],
          error: null,
        });
        return chain;
      }
      return mockSupabase;
    });

    const users = await getFollowerUsers('target-1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('follower-1');
    expect(users[0].displayName).toBe('フォロワーA');
    expect(mockSupabase.from).toHaveBeenCalledWith('follows');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('getFollowingUsers は DB からフォローしているユーザーを解決する', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'follows') {
        const chain = createChainMock({
          data: [{ follower_id: 'target-1', following_id: 'following-1' }],
          error: null,
        });
        return chain;
      }
      if (table === 'users') {
        const chain = createChainMock({
          data: [makeUserRow('following-1', 'フォロー先B')],
          error: null,
        });
        return chain;
      }
      return mockSupabase;
    });

    const users = await getFollowingUsers('target-1');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('following-1');
    expect(users[0].displayName).toBe('フォロー先B');
    expect(mockSupabase.from).toHaveBeenCalledWith('follows');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
  });

  it('フォロー関係がない場合は空配列を返す', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'follows') {
        const chain = createChainMock({
          data: [],
          error: null,
        });
        return chain;
      }
      return mockSupabase;
    });

    await expect(getFollowerUsers('target-1')).resolves.toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith('follows');
  });
});
