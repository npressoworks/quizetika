import { runTransaction, doc, getDocs } from 'firebase/firestore';
import {
  saveAttempt,
  getFailedQuestions,
  updateFailedQuestions,
} from '../../src/services/attempt';

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
    arrayRemove: jest.fn((...items) => items),
    runTransaction: jest.fn(),
    Timestamp: {
      fromDate: jest.fn((date) => date),
    },
  };
});

describe('AttemptService - saveAttempt', () => {
  const quizId = 'test-quiz-id';
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('通常スコアでの保存時、プレイ回数のインクリメントをアトミックに行い、リーダーボードは更新しないこと', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        leaderboard: [],
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    const attemptData = {
      userId,
      quizId,
      mode: 'normal' as const,
      score: 3, // パーフェクトではない
      totalQuestions: 5,
      elapsedSeconds: 45,
      failedQuestionIds: ['q2', 'q4'],
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    const attemptId = await saveAttempt(attemptData);
    expect(attemptId).toBeDefined();

    expect(mockTransaction.get).toHaveBeenCalledTimes(1);
    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // attempt レコード登録
    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // playCount インクリメント

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        playCount: 1, // increment(1) のダミー
      })
    );
  });

  test('パーフェクトスコアのとき、リーダーボードを更新すること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        leaderboard: [],
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    const attemptData = {
      userId,
      quizId,
      mode: 'normal' as const,
      score: 5, // パーフェクト！
      totalQuestions: 5,
      elapsedSeconds: 30,
      failedQuestionIds: [],
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    await saveAttempt(attemptData);

    // playCount と leaderboard の両方が更新されること
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        playCount: 1,
        leaderboard: expect.arrayContaining([
          expect.objectContaining({
            userId,
            score: 5,
          }),
        ]),
      })
    );
  });
});

describe('AttemptService - getFailedQuestions', () => {
  const userId = 'user-uid';

  test('過去に間違えた問題がない場合は、空配列を返すこと', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [],
    });

    const result = await getFailedQuestions(userId);
    expect(result).toEqual([]);
  });
});

describe('AttemptService - updateFailedQuestions', () => {
  const userId = 'user-uid';
  const quizId = 'quiz-id';

  test('正解した間違い問題のID配列をアトミックに除去し、トータル間違い数をアトミック減算すること', async () => {
    const mockAttemptDoc = {
      ref: { id: 'attempt-1' },
      data: () => ({
        failedQuestionIds: ['q1', 'q2'],
      }),
    };

    (getDocs as jest.Mock).mockResolvedValue({
      docs: [mockAttemptDoc],
    });

    const mockTransaction = {
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return callback(mockTransaction);
    });

    await updateFailedQuestions(userId, quizId, ['q1']);

    expect(mockTransaction.update).toHaveBeenCalledTimes(2);

    // attempt の failedQuestionIds から q1 を削除
    expect(mockTransaction.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'attempt-1' }),
      expect.objectContaining({
        failedQuestionIds: ['q1'], // arrayRemove('q1')
      })
    );

    // ユーザーの totalFailedQuestionsCount を -1
    expect(mockTransaction.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: userId }),
      expect.objectContaining({
        totalFailedQuestionsCount: -1, // increment(-1) のダミー
      })
    );
  });
});
