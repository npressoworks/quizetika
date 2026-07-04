jest.mock('../../src/lib/quiz-access', () => ({
  ...jest.requireActual('../../src/lib/quiz-access'),
  assertCanViewQuizAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

jest.mock('../../src/services/quiz', () => ({
  getQuiz: jest.fn(),
}));

// チェーン用のモックヘルパー（bookmark.test.ts と同様）
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve(resolveValue)),
  };
  return chain;
};

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(),
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { saveAttempt, getLeaderboard } from '../../src/services/attempt';
import { getQuiz } from '../../src/services/quiz';
import { createClient } from '../../src/lib/supabase/client';

const mockSupabase = createClient() as any;

const baseQuestions = [
  { id: 'q1' },
  { id: 'q2' },
  { id: 'q3' },
  { id: 'q4' },
  { id: 'q5' },
];

function mockQuiz(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-quiz-id',
    authorId: 'author-1',
    status: 'published',
    visibility: 'public',
    questions: baseQuestions,
    ...overrides,
  };
}

const quizId = 'test-quiz-id';
const userId = 'user-uid';

describe('saveAttempt - RPC へのモード委譲（初回/リプレイ判定はRPC側で実施）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getQuiz as jest.Mock).mockResolvedValue(mockQuiz());
    mockSupabase.rpc.mockResolvedValue({ data: 'attempt-id', error: null });
  });

  test('normal モードは p_mode: normal で RPC に委譲されること', async () => {
    await saveAttempt({
      userId,
      quizId,
      mode: 'normal',
      score: 3,
      totalQuestions: 5,
      elapsedSeconds: 45,
      failedQuestionIds: ['q2', 'q4'],
      aiTurnCount: 0,
      aiTurnLimit: null,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_save_attempt',
      expect.objectContaining({ p_mode: 'normal', p_user_id: userId, p_quiz_id: quizId })
    );
  });

  test('exam（模擬試験）モードも p_mode: exam のまま RPC に委譲されること（除外判定はRPC側）', async () => {
    await saveAttempt({
      userId,
      quizId,
      mode: 'exam',
      score: 5,
      totalQuestions: 5,
      elapsedSeconds: 120,
      failedQuestionIds: [],
      aiTurnCount: 0,
      aiTurnLimit: null,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_save_attempt',
      expect.objectContaining({ p_mode: 'exam' })
    );
  });

  test('review（弱点克服）モードも p_mode: review のまま RPC に委譲されること', async () => {
    await saveAttempt({
      userId,
      quizId,
      mode: 'review',
      score: 2,
      totalQuestions: 5,
      elapsedSeconds: 30,
      failedQuestionIds: ['q1', 'q2', 'q3'],
      aiTurnCount: 0,
      aiTurnLimit: null,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_save_attempt',
      expect.objectContaining({ p_mode: 'review' })
    );
  });
});

describe('getLeaderboard - leaderboard_entries からの上位N件取得', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('first_play ボードを score 降順・elapsed_seconds 昇順で上位5件取得すること', async () => {
    const rows = [
      {
        quiz_id: quizId,
        user_id: 'u1',
        display_name: 'Alice',
        score: 5,
        elapsed_seconds: 30,
        type: 'first_play',
        completed_at: new Date('2026-01-01').toISOString(),
      },
    ];
    mockSupabase.from.mockImplementation((table: string) => {
      expect(table).toBe('leaderboard_entries');
      return createChainMock({ data: rows, error: null });
    });

    const result = await getLeaderboard(quizId, 'first_play');

    expect(result).toEqual([
      expect.objectContaining({
        userId: 'u1',
        displayName: 'Alice',
        score: 5,
        elapsedSeconds: 30,
      }),
    ]);

    const chain = mockSupabase.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('quiz_id', quizId);
    expect(chain.eq).toHaveBeenCalledWith('type', 'first_play');
    expect(chain.order).toHaveBeenCalledWith('score', { ascending: false });
    expect(chain.order).toHaveBeenCalledWith('elapsed_seconds', { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  test('replay ボードを指定した場合は type=replay で絞り込むこと', async () => {
    mockSupabase.from.mockImplementation(() => createChainMock({ data: [], error: null }));

    await getLeaderboard(quizId, 'replay', 3);

    const chain = mockSupabase.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('type', 'replay');
    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  test('取得エラー時は空配列を返すこと', async () => {
    mockSupabase.from.mockImplementation(() =>
      createChainMock({ data: null, error: { message: 'boom' } })
    );

    const result = await getLeaderboard(quizId, 'first_play');
    expect(result).toEqual([]);
  });
});
