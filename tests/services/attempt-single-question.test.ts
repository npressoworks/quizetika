jest.mock('../../src/lib/quiz-access', () => ({
  ...jest.requireActual('../../src/lib/quiz-access'),
  assertCanViewQuizAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/quiz', () => ({
  getQuiz: jest.fn(),
}));

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { saveAttempt } from '../../src/services/attempt';
import { getQuiz } from '../../src/services/quiz';
import { createClient } from '../../src/lib/supabase/client';
import { isLeaderboardEligibleAttempt } from '../../src/lib/leaderboard-update';

const mockSupabase = createClient() as any;

const quizId = 'big-quiz';
const userId = 'user-uid';

function bigQuiz() {
  return {
    id: quizId,
    authorId: 'author-1',
    status: 'published',
    visibility: 'public',
    questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}` })),
  };
}

describe('saveAttempt - 1問単位モード', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getQuiz as jest.Mock).mockResolvedValue(bigQuiz());
    mockSupabase.rpc.mockResolvedValue({ data: 'attempt-id', error: null });
  });

  test('my-quiz: 親クイズ10問でも totalQuestions:1 で保存成功する', async () => {
    const attemptId = await saveAttempt({
      userId,
      quizId,
      mode: 'my-quiz',
      score: 1,
      totalQuestions: 1,
      elapsedSeconds: 10,
      failedQuestionIds: [],
      sessionId: 'sess-1',
      aiTurnCount: 0,
      aiTurnLimit: null,
    });
    expect(attemptId).toBeDefined();
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_save_attempt',
      expect.objectContaining({ p_mode: 'my-quiz', p_total_questions: 1, p_score: 1 })
    );
  });

  test('question-list: 新規保存は拒否する', async () => {
    await expect(
      saveAttempt({
        userId,
        quizId,
        listId: 'list-1',
        mode: 'question-list',
        score: 0,
        totalQuestions: 1,
        elapsedSeconds: 5,
        failedQuestionIds: ['q3'],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow('LIST_PLAY_MODE_DEPRECATED');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('list: 新規保存は拒否する', async () => {
    await expect(
      saveAttempt({
        userId,
        quizId,
        listId: 'list-1',
        mode: 'list',
        score: 1,
        totalQuestions: 10,
        elapsedSeconds: 5,
        failedQuestionIds: [],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow('LIST_PLAY_MODE_DEPRECATED');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('my-quiz: 存在しない failedQuestionIds で reject する', async () => {
    await expect(
      saveAttempt({
        userId,
        quizId,
        mode: 'my-quiz',
        score: 0,
        totalQuestions: 1,
        elapsedSeconds: 5,
        failedQuestionIds: ['nonexistent'],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow(/存在しない不正な問題ID/);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('normal モード: 全問数不一致は従来どおり reject する', async () => {
    await expect(
      saveAttempt({
        userId,
        quizId,
        mode: 'normal',
        score: 1,
        totalQuestions: 1,
        elapsedSeconds: 5,
        failedQuestionIds: [],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow(/問題数の不整合/);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('isLeaderboardEligibleAttempt: my-quiz は登録対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'my-quiz' })).toBe(true);
  });
});
