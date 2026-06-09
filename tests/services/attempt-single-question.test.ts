jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import { runTransaction, getDocs } from 'firebase/firestore';
import { saveAttempt } from '../../src/services/attempt';
import { isLeaderboardEligibleAttempt } from '../../src/lib/leaderboard-update';

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

describe('saveAttempt - 1問単位モード', () => {
  const quizId = 'big-quiz';
  const userId = 'user-uid';

  const mockQuizSnap = {
    exists: () => true,
    data: () => ({
      playCount: 0,
      leaderboardFirstPlay: [],
      leaderboardReplay: [],
      questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}` })),
    }),
  };

  function setupTransaction() {
    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) return mockQuizSnap;
        return { exists: () => true, data: () => ({ displayName: 'Tester' }) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    (runTransaction as jest.Mock).mockImplementation((_db, callback) => callback(mockTransaction));
    return mockTransaction;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
  });

  test('my-quiz: 親クイズ10問でも totalQuestions:1 で保存成功する', async () => {
    const tx = setupTransaction();
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
    expect(tx.set).toHaveBeenCalledTimes(1);
  });

  test('question-list: 親クイズ10問でも totalQuestions:1 で保存成功する（回帰）', async () => {
    const tx = setupTransaction();
    const attemptId = await saveAttempt({
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
    });
    expect(attemptId).toBeDefined();
    expect(tx.set).toHaveBeenCalledTimes(1);
  });

  test('my-quiz: 存在しない failedQuestionIds で reject する', async () => {
    setupTransaction();
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
  });

  test('normal モード: 全問数不一致は従来どおり reject する', async () => {
    setupTransaction();
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
  });

  test('isLeaderboardEligibleAttempt: my-quiz は登録対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'my-quiz' })).toBe(true);
  });
});
