import {
  resolveModerationTier,
  getReputationScore,
  checkModeratorEligibility,
  getReputationLimit,
  resetUserReputation,
  banUser,
  unbanUser,
} from '../../src/services/reputation';

const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
  };
  return chain;
};

const mockSupabase: any = {
  from: jest.fn(() => mockSupabase),
  rpc: jest.fn(),
};

jest.mock('../../src/lib/supabase/server', () => ({
  createClient: async () => mockSupabase,
}));

const supabase = mockSupabase;

describe('ReputationService - resolveModerationTier', () => {
  test('0 〜 49 点は newcomer', () => {
    expect(resolveModerationTier(0)).toBe('newcomer');
    expect(resolveModerationTier(49)).toBe('newcomer');
  });

  test('50 〜 149 点は contributor', () => {
    expect(resolveModerationTier(50)).toBe('contributor');
    expect(resolveModerationTier(149)).toBe('contributor');
  });

  test('150 〜 499 点は moderator', () => {
    expect(resolveModerationTier(150)).toBe('moderator');
    expect(resolveModerationTier(499)).toBe('moderator');
  });

  test('500 点以上は senior_moderator', () => {
    expect(resolveModerationTier(500)).toBe('senior_moderator');
    expect(resolveModerationTier(9999)).toBe('senior_moderator');
  });
});

describe('ReputationService - getReputationScore', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ユーザーが存在しない場合は、初期値（0点、newcomer、空履歴）を返す', async () => {
    supabase.from.mockReturnValue(createChainMock({ data: null, error: null }));

    const result = await getReputationScore('none-uid');
    expect(result).toEqual({
      reputationScore: 0,
      moderationTier: 'newcomer',
      reputationHistory: [],
    });
  });

  test('ユーザーが存在する場合は、設定されたデータを取得する', async () => {
    supabase.from.mockReturnValue(
      createChainMock({
        data: {
          reputation_score: 180,
          moderation_tier: 'moderator',
          reputation_history: [{ eventId: '1', delta: 10, reason: 'test', createdAt: new Date() }],
        },
        error: null,
      })
    );

    const result = await getReputationScore('test-uid');
    expect(result.reputationScore).toBe(180);
    expect(result.moderationTier).toBe('moderator');
    expect(result.reputationHistory).toHaveLength(1);
  });
});

describe('ReputationService - checkModeratorEligibility', () => {
  beforeEach(() => jest.clearAllMocks());

  test('newcomer と contributor は eligibility が false', async () => {
    supabase.from.mockReturnValue(
      createChainMock({ data: { reputation_score: 40, moderation_tier: 'newcomer' }, error: null })
    );
    expect(await checkModeratorEligibility('uid')).toBe(false);

    supabase.from.mockReturnValue(
      createChainMock({ data: { reputation_score: 80, moderation_tier: 'contributor' }, error: null })
    );
    expect(await checkModeratorEligibility('uid')).toBe(false);
  });

  test('moderator と senior_moderator は eligibility が true', async () => {
    supabase.from.mockReturnValue(
      createChainMock({ data: { reputation_score: 200, moderation_tier: 'moderator' }, error: null })
    );
    expect(await checkModeratorEligibility('uid')).toBe(true);

    supabase.from.mockReturnValue(
      createChainMock({ data: { reputation_score: 600, moderation_tier: 'senior_moderator' }, error: null })
    );
    expect(await checkModeratorEligibility('uid')).toBe(true);
  });
});

describe('ReputationService - getReputationLimit', () => {
  const authorId = 'author-uid';
  const senderId = 'sender-uid';

  beforeEach(() => jest.clearAllMocks());

  test('加算制限データが存在しない場合は、累計 0 pt を返す', async () => {
    supabase.from.mockReturnValue(createChainMock({ data: null, error: null }));

    const result = await getReputationLimit(authorId, senderId);
    expect(result).toEqual({ totalDelta: 0 });
  });

  test('加算制限データが存在する場合は、設定された totalDelta を返す', async () => {
    supabase.from.mockReturnValue(createChainMock({ data: { total_delta: 3 }, error: null }));

    const result = await getReputationLimit(authorId, senderId);
    expect(result).toEqual({ totalDelta: 3 });
  });
});

describe('ReputationService - resetUserReputation', () => {
  const targetUid = 'target-user-uid';
  const executorId = 'admin-executor-uid';
  const reason = 'コミュニティ荒らし行為のためリセット';

  beforeEach(() => jest.clearAllMocks());

  test('管理者が実行した場合、RPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await resetUserReputation(targetUid, executorId, reason);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_reset_user_reputation', {
      p_target_uid: targetUid,
      p_reason: reason,
    });
  });

  test('非管理者が実行した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(resetUserReputation(targetUid, 'non-admin-uid', reason)).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });

  test('理由が10文字未満の場合、RPCを呼ばずバリデーションエラーになること', async () => {
    await expect(resetUserReputation(targetUid, executorId, '短すぎ')).rejects.toThrow(
      'リセット理由は10文字以上で入力してください。'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('ReputationService - banUser', () => {
  const targetUid = 'target-user-uid';
  const executorId = 'admin-executor-uid';
  const reason = 'スパムメッセージ連投のルール違反行為のため';

  beforeEach(() => jest.clearAllMocks());

  test('管理者が実行した場合、RPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await banUser(targetUid, executorId, reason);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_ban_user', {
      p_target_uid: targetUid,
      p_reason: reason,
    });
  });

  test('理由が10文字未満の場合、RPCを呼ばずバリデーションエラーになること', async () => {
    await expect(banUser(targetUid, executorId, '短すぎ')).rejects.toThrow(
      'BAN理由は10文字以上で入力してください。'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('非管理者が実行した場合、拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(banUser(targetUid, 'non-admin', reason)).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });
});

describe('ReputationService - unbanUser', () => {
  const targetUid = 'target-user-uid';
  const executorId = 'admin-executor-uid';

  beforeEach(() => jest.clearAllMocks());

  test('管理者が実行した場合、RPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await unbanUser(targetUid, executorId);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_unban_user', {
      p_target_uid: targetUid,
    });
  });
});
