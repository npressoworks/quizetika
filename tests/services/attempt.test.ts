jest.mock('../../src/lib/quiz-access', () => ({
  ...jest.requireActual('../../src/lib/quiz-access'),
  assertCanViewQuizAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

jest.mock('../../src/services/attempt-session', () => ({
  getPendingSyncAttempts: jest.fn(),
  clearPendingSyncAttempt: jest.fn(),
}));

import { runTransaction, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import {
  saveAttempt,
  createLateralAttemptSession,
  getFailedQuestions,
  updateFailedQuestions,
  syncPendingAttempts,
} from '../../src/services/attempt';
import { getPendingSyncAttempts, clearPendingSyncAttempt } from '../../src/services/attempt-session';
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
    setDoc: jest.fn(),
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
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: 'published',
        authorId: 'author-1',
        visibility: 'public',
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }],
      }),
    });
  });

  test('通常スコアでも初回LBに記録しプレイ回数をインクリメントすること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        leaderboard: [],
        leaderboardFirstPlay: [],
        leaderboardReplay: [],
        questions: [
          { id: 'q1' },
          { id: 'q2' },
          { id: 'q3' },
          { id: 'q4' },
          { id: 'q5' },
        ],
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

    expect(mockTransaction.get).toHaveBeenCalledTimes(2); // クイズとユーザー情報の2回取得するため
    expect(mockTransaction.set).toHaveBeenCalledTimes(1); // attempt レコード登録
    expect(mockTransaction.update).toHaveBeenCalledTimes(1); // playCount インクリメント

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        playCount: 1,
        leaderboardFirstPlay: expect.arrayContaining([
          expect.objectContaining({ userId, score: 3 }),
        ]),
      })
    );
  });

  test('全問正解でも初回LBに記録すること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        leaderboard: [],
        leaderboardFirstPlay: [],
        leaderboardReplay: [],
        questions: [
          { id: 'q1' },
          { id: 'q2' },
          { id: 'q3' },
          { id: 'q4' },
          { id: 'q5' },
        ],
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

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        playCount: 1,
        leaderboardFirstPlay: expect.arrayContaining([
          expect.objectContaining({
            userId,
            score: 5,
          }),
        ]),
      })
    );
  });

  test('questionAnswerDetails の件数が不整合な場合にエラーを投げること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => callback(mockTransaction));

    const attemptData = {
      userId,
      quizId,
      mode: 'normal' as const,
      score: 1,
      totalQuestions: 2,
      elapsedSeconds: 30,
      failedQuestionIds: ['q2'],
      aiTurnCount: 0,
      aiTurnLimit: null,
      questionAnswerDetails: [
        {
          questionId: 'q1',
          questionType: 'multiple-choice' as const,
          isCorrect: true,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
      ],
    };

    await expect(saveAttempt(attemptData)).rejects.toThrow('解答詳細の件数が不整合です');
  });

  test('questionAnswerDetails の正解数とスコアが不整合な場合にエラーを投げること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => callback(mockTransaction));

    const attemptData = {
      userId,
      quizId,
      mode: 'normal' as const,
      score: 1,
      totalQuestions: 2,
      elapsedSeconds: 30,
      failedQuestionIds: ['q2'],
      aiTurnCount: 0,
      aiTurnLimit: null,
      questionAnswerDetails: [
        {
          questionId: 'q1',
          questionType: 'multiple-choice' as const,
          isCorrect: true,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
        {
          questionId: 'q2',
          questionType: 'multiple-choice' as const,
          isCorrect: true,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
      ],
    };

    await expect(saveAttempt(attemptData)).rejects.toThrow('解答詳細の正解数 (2) が送信されたスコア (1) と一致しません');
  });

  test('questionAnswerDetails にクイズに存在しない不正な問題IDがある場合にエラーを投げること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    };

    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((db, callback) => callback(mockTransaction));

    const attemptData = {
      userId,
      quizId,
      mode: 'normal' as const,
      score: 1,
      totalQuestions: 2,
      elapsedSeconds: 30,
      failedQuestionIds: ['q2'],
      aiTurnCount: 0,
      aiTurnLimit: null,
      questionAnswerDetails: [
        {
          questionId: 'q1',
          questionType: 'multiple-choice' as const,
          isCorrect: true,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
        {
          questionId: 'q_hack',
          questionType: 'multiple-choice' as const,
          isCorrect: false,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
      ],
    };

    await expect(saveAttempt(attemptData)).rejects.toThrow('該当クイズに存在しない不正な問題IDが解答詳細に含まれています: q_hack');
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

describe('AttemptService - createLateralAttemptSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未完了 attempt を作成し completedAt や playCount 更新は行わない', async () => {
    const attemptId = await createLateralAttemptSession('user-1', 'quiz-lateral-1', ['q-lt-1']);

    expect(attemptId).toBe('auto-generated-id');
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auto-generated-id' }),
      expect.objectContaining({
        userId: 'user-1',
        quizId: 'quiz-lateral-1',
        score: 0,
        totalQuestions: 1,
        failedQuestionIds: ['q-lt-1'],
        aiTurnCount: 0,
        aiTurnLimit: 30,
        listId: null,
        mode: 'normal',
      })
    );
    expect((setDoc as jest.Mock).mock.calls[0][1]).not.toHaveProperty('completedAt');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  test('リスト廃止後は常に mode=normal・listId=null で保存する', async () => {
    await createLateralAttemptSession('user-1', 'quiz-lateral-1', ['q-lt-1']);

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auto-generated-id' }),
      expect.objectContaining({
        listId: null,
        mode: 'normal',
        aiTurnLimit: 30,
      })
    );
  });
});

describe('AttemptService - syncPendingAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('保留中の attempt がある場合、詳細データも含めて saveAttempt が呼び出され成功時にローカルからクリアされること', async () => {
    const mockPending = {
      localId: 'local-123',
      userId: 'user-uid',
      quizId: 'test-quiz-id',
      listId: null,
      mode: 'normal' as const,
      score: 1,
      totalQuestions: 2,
      elapsedSeconds: 30,
      failedQuestionIds: ['q2'],
      completedAt: new Date().toISOString(),
      questionAnswers: [],
      questionAnswerDetails: [
        {
          questionId: 'q1',
          questionType: 'multiple-choice' as const,
          isCorrect: true,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
        {
          questionId: 'q2',
          questionType: 'multiple-choice' as const,
          isCorrect: false,
          elapsedSeconds: 15,
          hintsUsedCount: 0,
        },
      ],
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    (getPendingSyncAttempts as jest.Mock).mockReturnValue([mockPending]);

    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        playCount: 10,
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    };
    const mockTransaction = {
      get: jest.fn().mockReturnValue(mockQuizSnap),
      set: jest.fn(),
      update: jest.fn(),
    };
    (runTransaction as jest.Mock).mockImplementation((db, callback) => callback(mockTransaction));
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: 'published',
        questions: [{ id: 'q1' }, { id: 'q2' }],
      }),
    });

    const successCount = await syncPendingAttempts();

    expect(successCount).toBe(1);
    expect(clearPendingSyncAttempt).toHaveBeenCalledWith('local-123');
  });

  test('同期失敗（saveAttemptで例外スロー）した場合、ローカルストレージの未同期データがクリアされずに保持されること', async () => {
    const mockPending = {
      localId: 'local-456',
      userId: 'user-uid',
      quizId: 'test-quiz-id',
      listId: null,
      mode: 'normal' as const,
      score: 1,
      totalQuestions: 2,
      elapsedSeconds: 30,
      failedQuestionIds: ['q2'],
      completedAt: new Date().toISOString(),
      questionAnswers: [],
      questionAnswerDetails: [],
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    (getPendingSyncAttempts as jest.Mock).mockReturnValue([mockPending]);

    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const successCount = await syncPendingAttempts();

    expect(successCount).toBe(0);
    expect(clearPendingSyncAttempt).not.toHaveBeenCalled();
  });
});
