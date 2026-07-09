jest.mock('../../src/lib/quiz-access', () => ({
  ...jest.requireActual('../../src/lib/quiz-access'),
  assertCanViewQuizAsync: jest.fn().mockResolvedValue(undefined),
}));

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

// getMyLeaderboardRank の1本目のクエリ（自分の1行取得: .select().eq()...maybeSingle()）用チェーンモック
const createMaybeSingleChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
  };
  return chain;
};

// getMyLeaderboardRank の2本目のクエリ（真に上位の件数カウント: .select(..., {count,head})...or()）用チェーンモック
const createCountChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    or: jest.fn(() => Promise.resolve(resolveValue)),
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

import { saveAttempt, getLeaderboard, getMyLeaderboardRank } from '../../src/services/attempt';
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

describe('getMyLeaderboardRank - 自分の記録取得と順位算出', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const selfRow = {
    quiz_id: quizId,
    user_id: userId,
    display_name: 'Self User',
    score: 4,
    elapsed_seconds: 50,
    type: 'first_play',
    completed_at: new Date('2026-02-01').toISOString(),
  };

  const expectedRankFilter = `score.gt.${selfRow.score},and(score.eq.${selfRow.score},elapsed_seconds.lt.${selfRow.elapsed_seconds})`;

  test('自分の記録が存在し、真に上位の記録が2件ある場合、rank: 3 が返ること', async () => {
    mockSupabase.from
      .mockImplementationOnce(() => createMaybeSingleChainMock({ data: selfRow, error: null }))
      .mockImplementationOnce(() => createCountChainMock({ count: 2, error: null }));

    const result = await getMyLeaderboardRank(quizId, 'first_play', userId);

    expect(result).toEqual(
      expect.objectContaining({
        userId,
        displayName: 'Self User',
        score: 4,
        elapsedSeconds: 50,
        rank: 3,
      })
    );
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
  });

  test('自分の記録が存在しない場合（maybeSingle が data: null を返す場合）、null が返ること', async () => {
    mockSupabase.from.mockImplementationOnce(() =>
      createMaybeSingleChainMock({ data: null, error: null })
    );

    const result = await getMyLeaderboardRank(quizId, 'first_play', userId);

    expect(result).toBeNull();
    // 自分の記録が存在しない場合はカウントクエリを発行せず1回のみ from が呼ばれること
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  test('自分と正解数・合計解答時間が完全一致する他ユーザーが存在する場合、そのユーザーはカウントに含まれず同一順位になること（.or() フィルタ条件を検証）', async () => {
    const countChain = createCountChainMock({ count: 1, error: null });
    mockSupabase.from
      .mockImplementationOnce(() => createMaybeSingleChainMock({ data: selfRow, error: null }))
      .mockImplementationOnce(() => countChain);

    const result = await getMyLeaderboardRank(quizId, 'first_play', userId);

    // 完全一致（score同値かつelapsed_seconds同値）の相手は score.gt も
    // (score.eq AND elapsed_seconds.lt) も満たさないため、フィルタ条件自体が
    // 同順位の相手をカウントから除外する（＝同一順位になる）ことを保証する。
    expect(countChain.or).toHaveBeenCalledWith(expectedRankFilter);
    expect(result?.rank).toBe(2);
  });

  test('自分自身の記録がカウント対象に含まれないこと（自分の score/elapsed_seconds に対する .or() フィルタが真に上位のみを対象とすることを検証）', async () => {
    const countChain = createCountChainMock({ count: 0, error: null });
    mockSupabase.from
      .mockImplementationOnce(() => createMaybeSingleChainMock({ data: selfRow, error: null }))
      .mockImplementationOnce(() => countChain);

    const result = await getMyLeaderboardRank(quizId, 'first_play', userId);

    // 自分自身の行は score.gt も (score.eq AND elapsed_seconds.lt) も
    // 自分自身に対しては満たさないため、他に記録がなければ rank: 1 となり、
    // 自分自身がカウントに含まれていないことが確認できる。
    expect(countChain.or).toHaveBeenCalledWith(expectedRankFilter);
    expect(countChain.eq).toHaveBeenCalledWith('quiz_id', quizId);
    expect(countChain.eq).toHaveBeenCalledWith('type', 'first_play');
    expect(result?.rank).toBe(1);
  });

  test('カウントクエリでエラーが発生した場合に例外がスローされること', async () => {
    mockSupabase.from
      .mockImplementationOnce(() => createMaybeSingleChainMock({ data: selfRow, error: null }))
      .mockImplementationOnce(() =>
        createCountChainMock({ count: null, error: { message: 'count failed' } })
      );

    await expect(getMyLeaderboardRank(quizId, 'first_play', userId)).rejects.toThrow(
      '自分の順位算出に失敗しました: count failed'
    );
  });
});
