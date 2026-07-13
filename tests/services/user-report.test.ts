import { submitUserReport } from '../../src/services/user-report';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('UserReportService - submitUserReport', () => {
  const reporterId = 'reporter-uid';
  const targetUid = 'target-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('自己通報の場合はRPCを呼ばずに例外をスローすること', async () => {
    await expect(
      submitUserReport(reporterId, reporterId, 'harassment', '嫌がらせを受けました')
    ).rejects.toThrow('自分自身を通報することはできません');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('正常な通報でRPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await submitUserReport(reporterId, targetUid, 'spam', 'スパム投稿の疑いがあります');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_report_user', {
      p_target_uid: targetUid,
      p_category: 'spam',
      p_detail: 'スパム投稿の疑いがあります',
    });
  });

  test('RPC側で自己通報エラーが返された場合は日本語メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'self-report' } });

    await expect(
      submitUserReport(reporterId, targetUid, 'other', '理由')
    ).rejects.toThrow('自分自身を通報することはできません');
  });

  test('RPC側で不正なカテゴリエラーが返された場合は日本語メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'invalid-category' } });

    await expect(
      submitUserReport(reporterId, targetUid, 'other', '理由')
    ).rejects.toThrow('無効な通報カテゴリです');
  });

  test('RPC側で通報理由未入力エラーが返された場合は日本語メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'detail-required' } });

    await expect(
      submitUserReport(reporterId, targetUid, 'other', '')
    ).rejects.toThrow('通報理由を入力してください');
  });

  test('RPC側で対象ユーザーが見つからないエラーが返された場合は日本語メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'target-not-found' } });

    await expect(
      submitUserReport(reporterId, targetUid, 'other', '理由')
    ).rejects.toThrow('対象のユーザーが見つかりません');
  });

  test('未認証の場合は権限エラーの日本語メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(
      submitUserReport(reporterId, targetUid, 'other', '理由')
    ).rejects.toThrow('この操作を実行する権限がありません');
  });

  test('重複通報（冪等）の場合はRPCがエラーを返さずそのまま成功として解決すること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      submitUserReport(reporterId, targetUid, 'harassment', '再度の通報')
    ).resolves.toBeUndefined();
  });
});
