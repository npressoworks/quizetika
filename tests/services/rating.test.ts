import { submitDifficultyVote } from '../../src/services/rating';

// Supabase クライアントのチェーンモック
jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    maybeSingle: jest.fn(() => mock),
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';

describe('RatingService - submitDifficultyVote', () => {
  const quizId = 'test-quiz-id';
  const userId = 'test-user-id';
  const supabase = createClient() as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 異常系バリデーション ──────────────────────────────────────
  test('投票値が1未満の場合はエラーをスローし、RPCは呼ばれない', async () => {
    await expect(submitDifficultyVote(quizId, userId, 0)).rejects.toThrow(
      '難易度投票は1から5の範囲で指定してください。'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('投票値が5を超える場合はエラーをスローし、RPCは呼ばれない', async () => {
    await expect(submitDifficultyVote(quizId, userId, 6)).rejects.toThrow(
      '難易度投票は1から5の範囲で指定してください。'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  // ── 正常系: ログインユーザー ─────────────────────────────
  test('ログインユーザーの投票はhandle_submit_difficulty_vote RPCに正しいパラメータで渡される', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await submitDifficultyVote(quizId, userId, 4);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('handle_submit_difficulty_vote', {
      p_quiz_id: quizId,
      p_user_id: userId,
      p_vote: 4,
    });
  });

  // ── 正常系: 匿名ユーザー投票 ────────────────────────────────────
  test('匿名投票（userId = null）はp_user_id: nullでRPCに渡される', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await submitDifficultyVote(quizId, null, 4);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('handle_submit_difficulty_vote', {
      p_quiz_id: quizId,
      p_user_id: null,
      p_vote: 4,
    });
  });

  // ── 異常系: RPCがエラーを返す場合 ────────────────────────────────
  test('RPCがエラーを返した場合は例外をスローする', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(submitDifficultyVote(quizId, userId, 3)).rejects.toThrow();
  });
});
