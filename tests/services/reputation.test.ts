import {
  resolveModerationTier,
  getReputationScore,
  checkModeratorEligibility,
  getReputationLimit,
  resetUserReputation,
  banUser,
  unbanUser,
  downgradeUserTier,
  getReportedUsersRanking,
  getBannedUsers,
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

describe('ReputationService - downgradeUserTier', () => {
  const targetUid = 'target-user-uid';
  const executorId = 'admin-executor-uid';
  const newTier = 'contributor';
  const reason = '規約違反行為が確認されたためティアを引き下げ';

  beforeEach(() => jest.clearAllMocks());

  test('管理者が実行した場合、RPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await downgradeUserTier(targetUid, executorId, newTier, reason);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_downgrade_tier', {
      p_target_uid: targetUid,
      p_new_tier: newTier,
      p_reason: reason,
    });
  });

  test('理由が10文字未満の場合、RPCを呼ばずバリデーションエラーになること', async () => {
    await expect(downgradeUserTier(targetUid, executorId, newTier, '短すぎ')).rejects.toThrow(
      'ティア引き下げ理由は10文字以上で入力してください。'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('非管理者が実行した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(downgradeUserTier(targetUid, 'non-admin-uid', newTier, reason)).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });

  test('対象ユーザーが存在しない場合、エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'target-not-found' } });

    await expect(downgradeUserTier(targetUid, executorId, newTier, reason)).rejects.toThrow(
      '対象のユーザーが見つかりません'
    );
  });

  test('RPC側で理由が10文字未満と判定された場合、エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'reason-too-short' } });

    await expect(downgradeUserTier(targetUid, executorId, newTier, reason)).rejects.toThrow(
      'ティア引き下げ理由は10文字以上で入力してください。'
    );
  });

  test('引き下げ先ティアが現在より下位でない場合、エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'invalid-tier-downgrade' } });

    await expect(downgradeUserTier(targetUid, executorId, newTier, reason)).rejects.toThrow(
      '引き下げ先のティアは現在のティアより下位である必要があります'
    );
  });
});

describe('ReputationService - getReportedUsersRanking', () => {
  const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    uid: 'user-1',
    display_name: '通報太郎',
    moderation_tier: 'contributor',
    is_banned: false,
    total_report_count: 5,
    latest_report_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  test('RPCの戻り値（snake_case）が ReportedUserSummary[]（camelCase）へ正しくマッピングされること', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        makeRow({
          uid: 'user-1',
          display_name: '通報太郎',
          moderation_tier: 'moderator',
          is_banned: true,
          total_report_count: 12,
          latest_report_at: '2026-07-11T09:00:00.000Z',
        }),
      ],
      error: null,
    });

    const result = await getReportedUsersRanking(1, 10);

    expect(result.items).toEqual([
      {
        uid: 'user-1',
        displayName: '通報太郎',
        moderationTier: 'moderator',
        isBanned: true,
        totalReportCount: 12,
        latestReportAt: '2026-07-11T09:00:00.000Z',
      },
    ]);
  });

  test('結果件数が pageSize と同数の場合、hasMore は false になること', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ uid: `user-${i}` }));
    supabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getReportedUsersRanking(1, 10);

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(false);
  });

  test('結果件数が pageSize を超える場合、超過分は除外され hasMore は true になること', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => makeRow({ uid: `user-${i}` }));
    supabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getReportedUsersRanking(1, 10);

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.items.map((item) => item.uid)).toEqual(rows.slice(0, 10).map((r) => r.uid));
  });

  test('結果が0件の場合、空配列と hasMore=false を返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const result = await getReportedUsersRanking(1, 10);

    expect(result).toEqual({ items: [], hasMore: false });
  });

  test('page/pageSize から正しい p_limit/p_offset を算出してRPCを呼び出すこと（1ページ目）', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getReportedUsersRanking(1, 10);

    expect(supabase.rpc).toHaveBeenCalledWith('get_reported_users_ranking', {
      p_limit: 11,
      p_offset: 0,
    });
  });

  test('page/pageSize から正しい p_limit/p_offset を算出してRPCを呼び出すこと（3ページ目）', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getReportedUsersRanking(3, 20);

    expect(supabase.rpc).toHaveBeenCalledWith('get_reported_users_ranking', {
      p_limit: 21,
      p_offset: 40,
    });
  });

  test('非管理者が呼び出した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(getReportedUsersRanking(1, 10)).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });
});

describe('ReputationService - getBannedUsers', () => {
  const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    uid: 'user-1',
    display_name: 'BAN太郎',
    banned_reason: '規約違反',
    banned_at: '2026-07-10T00:00:00.000Z',
    banned_by_executor_id: 'admin-1',
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  test('RPCの戻り値（snake_case）が BannedUserSummary[]（camelCase）へ正しくマッピングされること（bannedByExecutorId含む）', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        makeRow({
          uid: 'user-1',
          display_name: 'BAN太郎',
          banned_reason: '規約違反行為のため',
          banned_at: '2026-07-11T09:00:00.000Z',
          banned_by_executor_id: 'admin-executor-uid',
        }),
      ],
      error: null,
    });

    const result = await getBannedUsers({ page: 1, pageSize: 10 });

    expect(result.items).toEqual([
      {
        uid: 'user-1',
        displayName: 'BAN太郎',
        bannedReason: '規約違反行為のため',
        bannedAt: '2026-07-11T09:00:00.000Z',
        bannedByExecutorId: 'admin-executor-uid',
      },
    ]);
  });

  test('bannedReason/bannedByExecutorId が null の行も正しくマッピングされること', async () => {
    supabase.rpc.mockResolvedValue({
      data: [makeRow({ banned_reason: null, banned_by_executor_id: null })],
      error: null,
    });

    const result = await getBannedUsers({ page: 1, pageSize: 10 });

    expect(result.items[0].bannedReason).toBeNull();
    expect(result.items[0].bannedByExecutorId).toBeNull();
  });

  test('フィルタ未指定の場合、bannedFrom/bannedTo/keyword は null としてRPCへ渡されること', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getBannedUsers({ page: 1, pageSize: 10 });

    expect(supabase.rpc).toHaveBeenCalledWith('get_banned_users', {
      p_limit: 11,
      p_offset: 0,
      p_banned_from: null,
      p_banned_to: null,
      p_keyword: null,
    });
  });

  test('bannedFrom/bannedTo/keyword が指定された場合、正しくRPCパラメータへ渡されること', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getBannedUsers({
      bannedFrom: '2026-07-01T00:00:00.000Z',
      bannedTo: '2026-07-10T00:00:00.000Z',
      keyword: 'user-1',
      page: 1,
      pageSize: 10,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('get_banned_users', {
      p_limit: 11,
      p_offset: 0,
      p_banned_from: '2026-07-01T00:00:00.000Z',
      p_banned_to: '2026-07-10T00:00:00.000Z',
      p_keyword: 'user-1',
    });
  });

  test('page/pageSize から正しい p_limit/p_offset を算出してRPCを呼び出すこと（3ページ目）', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getBannedUsers({ page: 3, pageSize: 20 });

    expect(supabase.rpc).toHaveBeenCalledWith('get_banned_users', {
      p_limit: 21,
      p_offset: 40,
      p_banned_from: null,
      p_banned_to: null,
      p_keyword: null,
    });
  });

  test('結果件数が pageSize と同数の場合、hasMore は false になること', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow({ uid: `user-${i}` }));
    supabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getBannedUsers({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(false);
  });

  test('結果件数が pageSize を超える場合、超過分は除外され hasMore は true になること', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => makeRow({ uid: `user-${i}` }));
    supabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getBannedUsers({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.items.map((item) => item.uid)).toEqual(rows.slice(0, 10).map((r) => r.uid));
  });

  test('結果が0件の場合、空配列と hasMore=false を返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const result = await getBannedUsers({ page: 1, pageSize: 10 });

    expect(result).toEqual({ items: [], hasMore: false });
  });

  test('非管理者が呼び出した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(getBannedUsers({ page: 1, pageSize: 10 })).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });
});
