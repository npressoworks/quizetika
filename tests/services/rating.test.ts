import { runTransaction, doc } from 'firebase/firestore';
import { submitDifficultyVote } from '../../src/services/rating';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, id) => ({ id, path: `${id}` })),
    collection: jest.fn((db, path) => ({ path })),
    increment: jest.fn((n) => n),
    runTransaction: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((date) => date),
    },
  };
});

describe('RatingService - submitDifficultyVote', () => {
  const quizId = 'test-quiz-id';
  const userId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 異常系バリデーション ──────────────────────────────────────
  test('投票値が1未満の場合はエラーをスローする', async () => {
    await expect(submitDifficultyVote(quizId, userId, 0)).rejects.toThrow(
      '難易度投票は1から10の範囲で指定してください。'
    );
  });

  test('投票値が10を超える場合はエラーをスローする', async () => {
    await expect(submitDifficultyVote(quizId, userId, 11)).rejects.toThrow(
      '難易度投票は1から10の範囲で指定してください。'
    );
  });

  // ── 正常系: ログインユーザー（新規投票） ─────────────────────────────
  test('ログインユーザーが新規に投票した場合、新規作成とカウンタインクリメントをアトミックに行う', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({ difficulty: 5 }),
    };

    const mockVoteSnap = {
      exists: () => false,
    };

    // runTransaction のモック
    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) return mockQuizSnap;
        return mockVoteSnap;
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await submitDifficultyVote(quizId, userId, 8);

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);

    // quizzes への更新内容の検証
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        difficultyVotesSum: 8,
        difficultyVotesCount: 1,
      })
    );
  });

  // ── 正常系: ログインユーザー（上書き投票） ───────────────────────────
  test('ログインユーザーが上書き投票した場合、投票データを更新し、差分のみをクイズに加算する', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({ difficulty: 5 }),
    };

    // 前回の投票は 5 点
    const mockVoteSnap = {
      exists: () => true,
      data: () => ({ userId, quizId, vote: 5 }),
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) return mockQuizSnap;
        return mockVoteSnap;
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    // 新たに 8 点を投票（差分 +3 点）
    await submitDifficultyVote(quizId, userId, 8);

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.set).not.toHaveBeenCalled();
    expect(mockTransaction.update).toHaveBeenCalledTimes(2);

    // voteDoc に対する更新の検証
    expect(mockTransaction.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: `${userId}_${quizId}` }),
      expect.objectContaining({ vote: 8 })
    );

    // quizDoc に対する差分更新の検証
    expect(mockTransaction.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        difficultyVotesSum: 3, // 8 - 5 = 3
      })
    );
  });

  // ── 正常系: 匿名ユーザー投票 ────────────────────────────────────
  test('匿名ユーザーが投票した場合、上書きチェックなしでアトミックに加算する', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({ difficulty: 5 }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await submitDifficultyVote(quizId, null, 7);

    // 匿名投票は quizSnap のみ get
    expect(mockTransaction.get).toHaveBeenCalledTimes(1);
    expect(mockTransaction.get).toHaveBeenCalledWith(expect.objectContaining({ id: quizId }));

    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // 匿名レコード新規作成
    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // カウンタ更新

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        difficultyVotesSum: 7,
        difficultyVotesCount: 1,
      })
    );
  });
});
