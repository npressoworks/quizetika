import { runTransaction, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  submitReview,
  getReviewStats,
  submitReviewResetRequest,
  resetReviews,
} from '../../src/services/review';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => {
      const id = paths.length > 0 ? paths[paths.length - 1] : 'auto-generated-id';
      return { id, path: paths.join('/') };
    }),
    collection: jest.fn((db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    limit: jest.fn((n) => ({ limit: n })),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    writeBatch: jest.fn(),
    increment: jest.fn((n) => n),
    arrayUnion: jest.fn((...items) => items),
    runTransaction: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((date) => date),
    },
  };
});

describe('ReviewService - submitReview', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';
  const authorId = 'author-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('作成者自身の投票はエラーになること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({ authorId }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await expect(submitReview(quizId, authorId, 'positive')).rejects.toThrow(
      'クイズの作成者は評価できません'
    );
  });

  test('新規投票のとき、正しくカウンタ加算とバッジの再計算が行われること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        authorId,
        positiveCount: 9,
        negativeCount: 0,
        isReviewMasked: false,
      }),
    };

    const mockVoteSnap = {
      exists: () => false,
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

    await submitReview(quizId, reviewerId, 'positive');

    expect(mockTransaction.get).toHaveBeenCalledTimes(2);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // 投票レコード作成
    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // カウンタ更新

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        positiveCount: 1, // increment(1) のダミー
        reviewScore: 1.0, // 10 / 10 = 1.0
        reviewBadge: '殿堂入り',
      })
    );
  });

  test('投票を変更した場合、カウンタの加減算とバッジ再計算が行われること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        authorId,
        positiveCount: 10,
        negativeCount: 0,
        isReviewMasked: false,
      }),
    };

    // 前回の投票は 👍
    const mockVoteSnap = {
      exists: () => true,
      data: () => ({ type: 'positive' }),
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) return mockQuizSnap;
        return mockVoteSnap;
      }),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    // 👎 に変更する
    await submitReview(quizId, reviewerId, 'negative');

    expect(mockTransaction.update).toHaveBeenCalledTimes(2); // 投票データ更新とクイズ更新

    // クイズのカウンタとスコア更新の検証
    expect(mockTransaction.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        positiveCount: -1, // increment(-1) のダミー
        negativeCount: 1, // increment(1) のダミー
        reviewScore: 0.9, // 9 / 10 = 0.9
        reviewBadge: '良問',
      })
    );
  });
});

describe('ReviewService - getReviewStats', () => {
  const quizId = 'test-quiz-id';

  test('クイズが存在しない場合は、初期値（null, 0, 0, null）を返す', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await getReviewStats('none-quiz');
    expect(result).toEqual({
      reviewScore: null,
      positiveCount: 0,
      negativeCount: 0,
      reviewBadge: null,
    });
  });

  test('仮リセット（マスク）期間中の場合、tempカウンタに基づいて過去の評価をマスクして返す', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        positiveCount: 20,
        negativeCount: 30,
        tempPositiveCount: 10, // 新規 👍 が10票
        tempNegativeCount: 0,
        isReviewMasked: true,
      }),
    });

    const result = await getReviewStats(quizId);
    expect(result).toEqual({
      reviewScore: 1.0, // 10 / 10 = 1.0
      positiveCount: 10,
      negativeCount: 0,
      reviewBadge: '殿堂入り',
      tempPositiveCount: 10,
      tempNegativeCount: 0,
    });
  });
});

describe('ReviewService - submitReviewResetRequest', () => {
  const quizId = 'test-quiz-id';
  const requesterId = 'author-uid';

  test('クイズ作成者が申請した場合、仮リセットマスク状態にアトミック移行すること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({ authorId: requesterId }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    const newRequestId = await submitReviewResetRequest(quizId, requesterId);
    expect(newRequestId).toBeDefined();

    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // リクエスト登録
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        isReviewMasked: true,
        tempPositiveCount: 0,
        tempNegativeCount: 0,
      })
    );
  });
});
