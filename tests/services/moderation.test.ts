import { flagContent, resolveFlag } from '../../src/services/moderation';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('ModerationService - flagContent', () => {
  const quizId = 'quiz-id';
  const reporterId = 'reporter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常な通報でRPCが呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await flagContent(quizId, reporterId, '規約違反の疑い');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_flag_content', {
      p_quiz_id: quizId,
      p_reason: '規約違反の疑い',
    });
  });

  test('RPCがエラーを返した場合は例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'banned' } });

    await expect(flagContent(quizId, reporterId, '理由')).rejects.toThrow(
      'コンテンツ通報の処理に失敗しました'
    );
  });
});

describe('ModerationService - resolveFlag', () => {
  const quizId = 'quiz-id';
  const executorId = 'admin-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('公開復帰アクションでRPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await resolveFlag(quizId, 'restore', executorId);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_resolve_flag', {
      p_quiz_id: quizId,
      p_action: 'restore',
    });
  });

  test('永久削除アクションでRPCが正しい引数で呼び出されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await resolveFlag(quizId, 'delete', executorId);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_resolve_flag', {
      p_quiz_id: quizId,
      p_action: 'delete',
    });
  });

  test('権限不足の場合はCISO制限メッセージで例外をスローすること', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'permission-denied' },
    });

    await expect(resolveFlag(quizId, 'restore', executorId)).rejects.toThrow(
      'この操作を実行する権限がありません (CISOセキュリティ制限)'
    );
  });
});
