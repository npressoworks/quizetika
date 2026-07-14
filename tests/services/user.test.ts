/**
 * Task 2.1 単体テスト: ユーザープロフィールと称号バッジアトミック管理 (Supabase 移行版)
 */

import {
  validateProfileData,
  BADGE_DEFINITIONS,
  UpdateProfileData,
  updateProfile,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowingUsers,
  getFollowerUsers,
  checkAndAwardBadges,
  followGenre,
  unfollowGenre,
  getUserLeaderboard,
} from '../../src/services/user';
import { User, Badge } from '../../src/types';
jest.mock('@/lib/supabase/client', () => {
  const mockInstance = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  };
  return {
    createClient: () => mockInstance,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.from.mockClear();
  mockSupabase.select.mockClear();
  mockSupabase.eq.mockClear();
  mockSupabase.in.mockClear();
  mockSupabase.single.mockReset();
  mockSupabase.maybeSingle.mockReset();
  mockSupabase.update.mockClear();
  mockSupabase.insert.mockClear();
  mockSupabase.upsert.mockClear();
  mockSupabase.delete.mockClear();
  mockSupabase.order.mockClear();
  mockSupabase.limit.mockReset();
  mockSupabase.rpc.mockReset();
  mockSupabase.auth.getSession.mockReset();

  // mockReturnThis を設定し直す
  mockSupabase.from.mockReturnValue(mockSupabase);
  mockSupabase.select.mockReturnValue(mockSupabase);
  mockSupabase.eq.mockReturnValue(mockSupabase);
  mockSupabase.in.mockReturnValue(mockSupabase);
  mockSupabase.update.mockReturnValue(mockSupabase);
  mockSupabase.insert.mockReturnValue(mockSupabase);
  mockSupabase.upsert.mockReturnValue(mockSupabase);
  mockSupabase.delete.mockReturnValue(mockSupabase);
  mockSupabase.order.mockReturnValue(mockSupabase);
});

/* ============================================================
   ヘルパー: テスト用のベースユーザーオブジェクトを生成
   ============================================================ */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-uid',
    email: 'test@example.com',
    displayName: 'テストユーザー',
    avatarUrl: '',
    bio: '',
    followedGenres: [],
    badges: [],
    createdQuizzesCount: 0,
    totalPlayCount: 0,
    followersCount: 0,
    followingCount: 0,
    reputationScore: 0,
    moderationTier: 'newcomer',
    reputationHistory: [],
    lastReputationCalculatedAt: null,
    totalFailedQuestionsCount: 0,
    deleteStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * データベースのRow型をモックするためのヘルパー
 */
function makeUserRow(overrides: any = {}) {
  return {
    id: 'test-uid',
    email: 'test@example.com',
    display_name: 'テストユーザー',
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
    ...overrides,
  };
}

/* ============================================================
   validateProfileData のテスト
   ============================================================ */
describe('validateProfileData', () => {
  describe('正常系', () => {
    test('有効なdisplayNameとbioはエラーなし', () => {
      const data: UpdateProfileData = { displayName: '山田太郎', bio: '好きなことを書く' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('bioが空文字列でもエラーなし', () => {
      const data: UpdateProfileData = { displayName: 'A', bio: '' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('displayNameがちょうど30文字でエラーなし', () => {
      const data: UpdateProfileData = { displayName: 'あ'.repeat(30), bio: '' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('bioがちょうど200文字でエラーなし', () => {
      const data: UpdateProfileData = { displayName: '有効ユーザー', bio: 'あ'.repeat(200) };
      expect(validateProfileData(data)).toHaveLength(0);
    });
  });

  describe('異常系: displayName', () => {
    test('displayNameが空文字列はエラー', () => {
      const data: UpdateProfileData = { displayName: '', bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });

    test('displayNameがスペースのみはエラー', () => {
      const data: UpdateProfileData = { displayName: '   ', bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });

    test('displayNameが31文字はエラー', () => {
      const data: UpdateProfileData = { displayName: 'あ'.repeat(31), bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });
  });

  describe('異常系: bio', () => {
    test('bioが201文字はエラー', () => {
      const data: UpdateProfileData = { displayName: '有効ユーザー', bio: 'あ'.repeat(201) };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('bio');
    });
  });

  describe('複数エラー', () => {
    test('displayNameとbioの両方が無効な場合、2件のエラーを返す', () => {
      const data: UpdateProfileData = { displayName: '', bio: 'あ'.repeat(201) };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.field)).toContain('displayName');
      expect(errors.map((e) => e.field)).toContain('bio');
    });
  });

  describe('正常系: snsLinks', () => {
    test('有効なSNSリンクはエラーなし', () => {
      const data: UpdateProfileData = {
        displayName: '山田太郎',
        bio: '自己紹介',
        snsLinks: {
          youtube: 'https://youtube.com/channel/abc',
          x: 'https://x.com/username',
          instagram: 'https://instagram.com/username',
          tiktok: 'https://tiktok.com/@username',
        }
      };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('一部のSNSリンクのみ指定されていてもエラーなし', () => {
      const data: UpdateProfileData = {
        displayName: '山田太郎',
        bio: '自己紹介',
        snsLinks: {
          youtube: 'https://youtu.be/watch?v=123',
          x: 'https://twitter.com/username',
        }
      };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('snsLinksが空オブジェクト、またはundefinedでもエラーなし', () => {
      const data1: UpdateProfileData = { displayName: '山田太郎', bio: '自己紹介', snsLinks: {} };
      const data2: UpdateProfileData = { displayName: '山田太郎', bio: '自己紹介', snsLinks: undefined };
      expect(validateProfileData(data1)).toHaveLength(0);
      expect(validateProfileData(data2)).toHaveLength(0);
    });

    test('空文字列やスペースのみのSNSリンクは許容されエラーなし（保存時に無視または削除される）', () => {
      const data: UpdateProfileData = {
        displayName: '山田太郎',
        bio: '自己紹介',
        snsLinks: {
          youtube: '',
          x: '   ',
        }
      };
      expect(validateProfileData(data)).toHaveLength(0);
    });
  });

  describe('異常系: snsLinks', () => {
    test('不正なURL形式はエラー', () => {
      const data: UpdateProfileData = {
        displayName: '山田太郎',
        bio: '自己紹介',
        snsLinks: {
          youtube: 'invalid-url',
        }
      };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('snsLinks.youtube');
      expect(errors[0].message).toContain('正しいURL形式');
    });

    test('未許可ドメインのURLはエラー', () => {
      const data: UpdateProfileData = {
        displayName: '山田太郎',
        bio: '自己紹介',
        snsLinks: {
          youtube: 'https://google.com',
          x: 'https://x.com.attacker.com/username',
          instagram: 'https://facebook.com',
          tiktok: 'https://t.co/username',
        }
      };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(4);
      expect(errors.map(e => e.field)).toContain('snsLinks.youtube');
      expect(errors.map(e => e.field)).toContain('snsLinks.x');
      expect(errors.map(e => e.field)).toContain('snsLinks.instagram');
      expect(errors.map(e => e.field)).toContain('snsLinks.tiktok');
    });
  });
});

/* ============================================================
   BADGE_DEFINITIONS のバッジ条件ロジックテスト
   ============================================================ */

function getBadgeDef(id: string) {
  const def = BADGE_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`バッジ定義が見つかりません: ${id}`);
  return def;
}

describe('BADGE_DEFINITIONS - プレイ回数バッジ', () => {
  test.each([
    ['play_10', 10],
    ['play_50', 50],
    ['play_100', 100],
    ['play_500', 500],
    ['play_1000', 1000],
  ])('%s はtotalPlayCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ totalPlayCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ totalPlayCount: threshold }))).toBe(true);
    expect(def.condition(makeUser({ totalPlayCount: threshold + 1 }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - 作成数バッジ', () => {
  test.each([
    ['create_1', 1],
    ['create_10', 10],
    ['create_50', 50],
  ])('%s はcreatedQuizzesCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ createdQuizzesCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ createdQuizzesCount: threshold }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - フォロワー数バッジ', () => {
  test.each([
    ['followers_10', 10],
    ['followers_100', 100],
    ['followers_1000', 1000],
  ])('%s はfollowersCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ followersCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ followersCount: threshold }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - 全バッジIDがユニークであること', () => {
  test('バッジIDの重複がない', () => {
    const ids = BADGE_DEFINITIONS.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

/* ============================================================
   updateProfile のテスト
   ============================================================ */
describe('updateProfile', () => {
  const uid = 'test-uid';

  test('正常系: バリデーションに合格したプロフィールとSNSリンクを保存する', async () => {
    const data: UpdateProfileData = {
      displayName: '山田太郎',
      bio: '自己紹介',
      snsLinks: {
        youtube: 'https://youtube.com/channel/abc',
        x: 'https://x.com/username',
      }
    };

    await updateProfile(uid, data);

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: '山田太郎',
        bio: '自己紹介',
        sns_links: {
          youtube: 'https://youtube.com/channel/abc',
          x: 'https://x.com/username',
        },
        updated_at: expect.any(String),
      })
    );
  });

  test('異常系: バリデーションエラー時は例外を投げて保存しない', async () => {
    const data: UpdateProfileData = {
      displayName: '',
      bio: '自己紹介',
    };

    await expect(updateProfile(uid, data)).rejects.toThrow('プロフィールのバリデーションに失敗しました');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  test('正常系（Phase 30）: avatarUrl が指定された場合は avatar_url を更新対象に含める', async () => {
    const data: UpdateProfileData = {
      displayName: '山田太郎',
      bio: '自己紹介',
      avatarUrl: 'https://project.supabase.co/storage/v1/object/public/users/test-uid/avatar_1.png',
    };

    await updateProfile(uid, data);

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: 'https://project.supabase.co/storage/v1/object/public/users/test-uid/avatar_1.png',
      })
    );
  });

  test('正常系（Phase 30）: avatarUrl が未指定の場合は avatar_url を更新対象に含めない', async () => {
    const data: UpdateProfileData = {
      displayName: '山田太郎',
      bio: '自己紹介',
    };

    await updateProfile(uid, data);

    const updatePayload = mockSupabase.update.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('avatar_url');
  });
});

describe('UserService - followUser', () => {
  const followerId = 'follower-uid';
  const followingId = 'following-uid';

  test('フォローが成功した際、被フォローユーザー宛ての通知が作成されること', async () => {
    // mock handle_follow_user RPC
    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });
    
    // mock getUserProfile for followerId to create notice details
    mockSupabase.single.mockResolvedValueOnce({
      data: makeUserRow({ id: followerId, display_name: 'フォロワー名', avatar_url: 'avatar-url' }),
      error: null,
    });

    const result = await followUser(followerId, followingId);
    expect(result.isFollowing).toBe(true);

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: followingId,
        type: 'follow',
        sender_id: followerId,
        sender_name: 'フォロワー名',
        sender_avatar: 'avatar-url',
        target_id: followerId,
      })
    );
  });
});

describe('UserService - checkAndAwardBadges', () => {
  const uid = 'user-uid';

  test('新規バッジがアトミック付与された際、バッジ獲得通知が作成されること', async () => {
    // プレイ回数が10回のユーザー
    const userRow = makeUserRow({
      id: uid,
      total_play_count: 10,
      badges: [],
    });

    mockSupabase.single.mockResolvedValueOnce({ data: userRow, error: null });
    mockSupabase.rpc.mockResolvedValueOnce({ data: ['play_10'], error: null });

    const badges = await checkAndAwardBadges(uid);
    expect(badges).toHaveLength(1);
    expect(badges[0].id).toBe('play_10');

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_check_and_award_badges',
      expect.objectContaining({
        p_user_id: uid,
        p_badge_ids: expect.arrayContaining(['play_10']),
      })
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: uid,
        type: 'badge_unlocked',
        sender_id: 'system',
        sender_name: '運営',
        target_id: 'play_10',
        target_title: '初挑戦者',
      })
    );
  });

  test('RPCが同時実行で既に付与済み（空配列）を返した場合、重複通知を作成しないこと', async () => {
    const userRow = makeUserRow({ id: uid, total_play_count: 10, badges: [] });

    mockSupabase.single.mockResolvedValueOnce({ data: userRow, error: null });
    mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

    const badges = await checkAndAwardBadges(uid);

    expect(badges).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalledWith('notifications');
  });
});

describe('UserService - followGenre / unfollowGenre', () => {
  test('followGenre は user_genre_follows へ単一行を upsert すること', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });

    await followGenre('user-1', 'programming');

    expect(mockSupabase.from).toHaveBeenCalledWith('user_genre_follows');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', genre_id: 'programming' },
      { onConflict: 'user_id,genre_id' }
    );
  });

  test('unfollowGenre は user_genre_follows から単一行を delete すること', async () => {
    await unfollowGenre('user-1', 'programming');

    expect(mockSupabase.from).toHaveBeenCalledWith('user_genre_follows');
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockSupabase.eq).toHaveBeenCalledWith('genre_id', 'programming');
  });
});

describe('UserService - getUserLeaderboard', () => {
  test('reputationScore指定時、reputation_score降順で取得すること', async () => {
    const rows = [makeUserRow({ id: 'u-1', reputation_score: 100 })];
    mockSupabase.limit.mockResolvedValueOnce({ data: rows, error: null });

    const result = await getUserLeaderboard('reputationScore', 10);

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(mockSupabase.order).toHaveBeenCalledWith('reputation_score', { ascending: false });
    expect(mockSupabase.limit).toHaveBeenCalledWith(10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u-1');
  });

  test('totalPlayCount指定時、total_play_count降順で取得すること', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

    await getUserLeaderboard('totalPlayCount', 5);

    expect(mockSupabase.order).toHaveBeenCalledWith('total_play_count', { ascending: false });
    expect(mockSupabase.limit).toHaveBeenCalledWith(5);
  });

  test('createdQuizzesCount指定時、created_quizzes_count降順で取得すること', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });

    await getUserLeaderboard('createdQuizzesCount');

    expect(mockSupabase.order).toHaveBeenCalledWith('created_quizzes_count', { ascending: false });
    expect(mockSupabase.limit).toHaveBeenCalledWith(10);
  });

  test('エラー発生時は空配列を返すこと', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const result = await getUserLeaderboard('reputationScore');
    expect(result).toEqual([]);
  });
});
