import {
  getReportedUsersRanking,
  getBannedUsers,
  getUserAdminLogs,
  getUserOpenReportCount,
  unbanUser,
} from '../../src/services/reputation-client';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('ReputationClientService - getReportedUsersRanking', () => {
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

describe('ReputationClientService - getBannedUsers', () => {
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

describe('ReputationClientService - getUserAdminLogs', () => {
  beforeEach(() => jest.clearAllMocks());

  const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'log-1',
    action: 'ban',
    executor_id: 'admin-1',
    reason: 'BAN理由テキスト',
    created_at: '2026-07-10T00:00:00.000Z',
    ...overrides,
  });

  test('RPCの戻り値（4種のactionを含む複数行）を AdminLogEntry[] へ正しくマッピングすること', async () => {
    const rows = [
      makeRow({ id: 'log-1', action: 'reputation_reset' }),
      makeRow({ id: 'log-2', action: 'ban' }),
      makeRow({ id: 'log-3', action: 'unban' }),
      makeRow({ id: 'log-4', action: 'tier_downgrade' }),
    ];
    supabase.rpc.mockResolvedValue({ data: rows, error: null });

    const result = await getUserAdminLogs('target-uid');

    expect(result).toEqual([
      {
        id: 'log-1',
        action: 'reputation_reset',
        executorId: 'admin-1',
        reason: 'BAN理由テキスト',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
      {
        id: 'log-2',
        action: 'ban',
        executorId: 'admin-1',
        reason: 'BAN理由テキスト',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
      {
        id: 'log-3',
        action: 'unban',
        executorId: 'admin-1',
        reason: 'BAN理由テキスト',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
      {
        id: 'log-4',
        action: 'tier_downgrade',
        executorId: 'admin-1',
        reason: 'BAN理由テキスト',
        createdAt: '2026-07-10T00:00:00.000Z',
      },
    ]);
  });

  test('executor_id / reason が null の行は、executorId / reason が null としてマッピングされること', async () => {
    supabase.rpc.mockResolvedValue({
      data: [makeRow({ executor_id: null, reason: null })],
      error: null,
    });

    const result = await getUserAdminLogs('target-uid');

    expect(result[0].executorId).toBeNull();
    expect(result[0].reason).toBeNull();
  });

  test('p_target_uid パラメータが正しく渡されること', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await getUserAdminLogs('target-uid-123');

    expect(supabase.rpc).toHaveBeenCalledWith('get_user_admin_logs', {
      p_target_uid: 'target-uid-123',
    });
  });

  test('結果が0件の場合、空配列を返すこと（エラーにしないこと）', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const result = await getUserAdminLogs('target-uid');

    expect(result).toEqual([]);
  });

  test('非管理者が呼び出した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(getUserAdminLogs('target-uid')).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });
});

describe('ReputationClientService - getUserOpenReportCount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('RPCが整数を返す場合、その値をそのまま返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: 3, error: null });

    const result = await getUserOpenReportCount('target-uid');

    expect(result).toBe(3);
  });

  test('未処理通報が0件の場合、0を返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: 0, error: null });

    const result = await getUserOpenReportCount('target-uid');

    expect(result).toBe(0);
  });

  test('RPCの戻り値が数値でない場合、0を返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await getUserOpenReportCount('target-uid');

    expect(result).toBe(0);
  });

  test('p_target_uid パラメータが正しく渡されること', async () => {
    supabase.rpc.mockResolvedValue({ data: 0, error: null });

    await getUserOpenReportCount('target-uid-123');

    expect(supabase.rpc).toHaveBeenCalledWith('get_user_open_report_count', {
      p_target_uid: 'target-uid-123',
    });
  });

  test('非管理者が呼び出した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(getUserOpenReportCount('target-uid')).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });
});

describe('ReputationClientService - unbanUser', () => {
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

  test('非管理者が実行した場合、権限エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(unbanUser(targetUid, 'non-admin-uid')).rejects.toThrow(
      'この操作を実行する権限がありません'
    );
  });

  test('対象ユーザーが存在しない場合、エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'target-not-found' } });

    await expect(unbanUser(targetUid, executorId)).rejects.toThrow(
      '対象のユーザーが見つかりません'
    );
  });
});
