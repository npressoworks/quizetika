import {
  adminExecuteMerge,
  adminResolveMergeRequest,
  adminResolveGenreRequest,
} from '../../src/services/governanceAdmin';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('GovernanceAdminService - adminExecuteMerge', () => {
  const sourceId = 'source-tag';
  const targetId = 'target-tag';
  const targetType = 'tag';
  const reason = '管理者による整理';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常に即時マージを実行し、リクエストIDを返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: 'generated-request-uuid', error: null });

    const result = await adminExecuteMerge(sourceId, targetId, targetType, reason);

    expect(result).toBe('generated-request-uuid');
    expect(supabase.rpc).toHaveBeenCalledWith('handle_admin_execute_merge', {
      p_target_type: targetType,
      p_source_id: sourceId,
      p_target_id: targetId,
      p_reason: reason,
    });
  });

  test('非管理者の呼び出しはforbiddenエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });

    await expect(
      adminExecuteMerge(sourceId, targetId, targetType, reason)
    ).rejects.toThrow('管理者権限がありません。');
  });

  test('同一ID同士のマージはsame-idエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'same-id' } });

    await expect(
      adminExecuteMerge(sourceId, sourceId, targetType, reason)
    ).rejects.toThrow('同一のタグ/ジャンルをマージすることはできません。');
  });

  test('循環マージはcircular-mergeエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'circular-merge' } });

    await expect(
      adminExecuteMerge(sourceId, targetId, targetType, reason)
    ).rejects.toThrow('循環マージが発生するため、このマージは実行できません。');
  });

  test('重複時は23505エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await expect(
      adminExecuteMerge(sourceId, targetId, targetType, reason)
    ).rejects.toThrow('既に同じマージ提案が進行中です。');
  });

  test('その他のエラーは汎用メッセージをthrowすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'some db error' } });

    await expect(
      adminExecuteMerge(sourceId, targetId, targetType, reason)
    ).rejects.toThrow('マージの即時実行に失敗しました: some db error');
  });
});

describe('GovernanceAdminService - adminResolveMergeRequest', () => {
  const requestId = 'request-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('承認決定がRPC経由で正しく送信されること', async () => {
    supabase.rpc.mockResolvedValue({ error: null });

    await adminResolveMergeRequest(requestId, 'approve');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_admin_resolve_merge_request', {
      p_request_id: requestId,
      p_decision: 'approve',
    });
  });

  test('非管理者の呼び出しはforbiddenエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'forbidden' } });

    await expect(adminResolveMergeRequest(requestId, 'approve')).rejects.toThrow(
      '管理者権限がありません。'
    );
  });

  test('存在しないリクエストはrequest-not-foundエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'request-not-found' } });

    await expect(adminResolveMergeRequest(requestId, 'approve')).rejects.toThrow(
      'マージ提案が見つかりません。'
    );
  });

  test('既に処理済みの提案はalready-resolvedエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'already-resolved' } });

    await expect(adminResolveMergeRequest(requestId, 'approve')).rejects.toThrow(
      'この提案は既に処理済みです。'
    );
  });

  test('その他のエラーは汎用メッセージをthrowすること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'unknown error' } });

    await expect(adminResolveMergeRequest(requestId, 'approve')).rejects.toThrow(
      'マージ提案の処理に失敗しました: unknown error'
    );
  });
});

describe('GovernanceAdminService - adminResolveGenreRequest', () => {
  const requestId = 'request-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('却下決定がRPC経由で正しく送信されること', async () => {
    supabase.rpc.mockResolvedValue({ error: null });

    await adminResolveGenreRequest(requestId, 'reject');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_admin_resolve_genre_request', {
      p_request_id: requestId,
      p_decision: 'reject',
    });
  });

  test('非管理者の呼び出しはforbiddenエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'forbidden' } });

    await expect(adminResolveGenreRequest(requestId, 'reject')).rejects.toThrow(
      '管理者権限がありません。'
    );
  });

  test('存在しない申請はrequest-not-foundエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'request-not-found' } });

    await expect(adminResolveGenreRequest(requestId, 'reject')).rejects.toThrow(
      'ジャンル申請が見つかりません。'
    );
  });

  test('既に処理済みの申請はalready-resolvedエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'already-resolved' } });

    await expect(adminResolveGenreRequest(requestId, 'reject')).rejects.toThrow(
      'この申請は既に処理済みです。'
    );
  });

  test('ジャンルIDの重複（23505）はID重複エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });

    await expect(adminResolveGenreRequest(requestId, 'approve')).rejects.toThrow(
      '指定されたジャンルIDはすでに存在します。'
    );
  });

  test('その他のエラーは汎用メッセージをthrowすること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'unknown error' } });

    await expect(adminResolveGenreRequest(requestId, 'reject')).rejects.toThrow(
      'ジャンル申請の処理に失敗しました: unknown error'
    );
  });
});
