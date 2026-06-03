jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import { runTransaction } from 'firebase/firestore';
import { saveAttempt } from '../../src/services/attempt';
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
    getDoc: jest.fn(),
    getDocs: jest.fn().mockResolvedValue({ docs: [] }),
    runTransaction: jest.fn(),
    increment: jest.fn((n) => n),
  };
});

const quizId = 'test-quiz-id';
const userId = 'user-uid';

const baseQuestions = [
  { id: 'q1' },
  { id: 'q2' },
  { id: 'q3' },
  { id: 'q4' },
  { id: 'q5' },
];

function mockQuiz(overrides: Record<string, unknown> = {}) {
  return {
    playCount: 10,
    leaderboard: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    questions: baseQuestions,
    ...overrides,
  };
}

describe('saveAttempt - Phase 5 leaderboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('非全問正解でも初回プレイLBに反映されること', async () => {
    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) {
          return { exists: () => true, data: () => mockQuiz() };
        }
        return {
          exists: () => true,
          data: () => ({ displayName: 'Tester' }),
        };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((_db, callback) =>
      callback(mockTransaction)
    );

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

    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: quizId }),
      expect.objectContaining({
        leaderboardFirstPlay: expect.arrayContaining([
          expect.objectContaining({ userId, score: 3, elapsedSeconds: 45 }),
        ]),
      })
    );
    const updateArg = mockTransaction.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { id: string }).id === quizId
    )?.[1];
    expect(updateArg.leaderboardReplay).toBeUndefined();
  });

  test('2回目以降はリプレイLBのみ更新されること', async () => {
    const { getDocs } = require('firebase/firestore');
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [{ id: 'prior-1', data: () => ({ completedAt: new Date() }) }],
    });

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === quizId) {
          return {
            exists: () => true,
            data: () =>
              mockQuiz({
                leaderboardFirstPlay: [
                  {
                    userId,
                    displayName: 'Tester',
                    score: 3,
                    elapsedSeconds: 50,
                    completedAt: new Date(),
                  },
                ],
              }),
          };
        }
        return {
          exists: () => true,
          data: () => ({ displayName: 'Tester' }),
        };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation((_db, callback) =>
      callback(mockTransaction)
    );

    await saveAttempt({
      userId,
      quizId,
      mode: 'normal',
      score: 4,
      totalQuestions: 5,
      elapsedSeconds: 40,
      failedQuestionIds: ['q5'],
      aiTurnCount: 0,
      aiTurnLimit: null,
    });

    const updateArg = mockTransaction.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { id: string }).id === quizId
    )?.[1];
    expect(updateArg.leaderboardReplay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId, score: 4 }),
      ])
    );
    expect(updateArg.leaderboardFirstPlay).toBeUndefined();
  });
});
