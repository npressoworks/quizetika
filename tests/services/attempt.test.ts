jest.mock('../../src/lib/quiz-access', () => ({
  ...jest.requireActual('../../src/lib/quiz-access'),
  assertCanViewQuizAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

jest.mock('../../src/services/attempt-session', () => ({
  getPendingSyncAttempts: jest.fn(),
  clearPendingSyncAttempt: jest.fn(),
}));

jest.mock('../../src/services/quiz', () => ({
  getQuiz: jest.fn(),
}));

// Supabase クライアントのモックを作成（bookmark.test.ts と同様のチェーン + rpc パターン）
jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { runTransaction, getDocs } from 'firebase/firestore';
import {
  saveAttempt,
  createLateralAttemptSession,
  getFailedQuestions,
  updateFailedQuestions,
  syncPendingAttempts,
} from '../../src/services/attempt';
import { getPendingSyncAttempts, clearPendingSyncAttempt } from '../../src/services/attempt-session';
import { getQuiz } from '../../src/services/quiz';
import { createClient } from '../../src/lib/supabase/client';

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

const mockSupabase = createClient() as any;

function mockQuiz(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-quiz-id',
    authorId: 'author-1',
    status: 'published',
    visibility: 'public',
    questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }],
    ...overrides,
  };
}

describe('AttemptService - saveAttempt', () => {
  const quizId = 'test-quiz-id';
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    (getQuiz as jest.Mock).mockResolvedValue(mockQuiz());
    mockSupabase.rpc.mockResolvedValue({ data: 'new-attempt-id', error: null });
  });

  test('RPC 呼び出しでプレイ結果を保存し attempt id を返すこと', async () => {
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
    expect(attemptId).toBe('new-attempt-id');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_save_attempt', {
      p_user_id: userId,
      p_quiz_id: quizId,
      p_mode: 'normal',
      p_score: 3,
      p_total_questions: 5,
      p_elapsed_seconds: 45,
      p_failed_question_ids: ['q2', 'q4'],
      p_question_answers: [],
      p_question_answer_details: [],
    });
  });

  test('全問正解でも RPC 呼び出しで保存できること', async () => {
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

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'handle_save_attempt',
      expect.objectContaining({ p_score: 5, p_failed_question_ids: [] })
    );
  });

  test('クイズが見つからない場合エラーを投げRPCは呼び出さないこと', async () => {
    (getQuiz as jest.Mock).mockResolvedValue(null);

    await expect(
      saveAttempt({
        userId,
        quizId,
        mode: 'normal',
        score: 5,
        totalQuestions: 5,
        elapsedSeconds: 30,
        failedQuestionIds: [],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow(`クイズが見つかりません: ${quizId}`);

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('RPC がエラーを返した場合、エラーメッセージを含めて例外を投げること', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: '問題数が一致しません' } });

    await expect(
      saveAttempt({
        userId,
        quizId,
        mode: 'normal',
        score: 5,
        totalQuestions: 5,
        elapsedSeconds: 30,
        failedQuestionIds: [],
        aiTurnCount: 0,
        aiTurnLimit: null,
      })
    ).rejects.toThrow('問題数が一致しません');
  });

  test('questionAnswerDetails の件数が不整合な場合にエラーを投げること', async () => {
    (getQuiz as jest.Mock).mockResolvedValue(
      mockQuiz({ questions: [{ id: 'q1' }, { id: 'q2' }] })
    );

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
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('questionAnswerDetails の正解数とスコアが不整合な場合にエラーを投げること', async () => {
    (getQuiz as jest.Mock).mockResolvedValue(
      mockQuiz({ questions: [{ id: 'q1' }, { id: 'q2' }] })
    );

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
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('questionAnswerDetails にクイズに存在しない不正な問題IDがある場合にエラーを投げること', async () => {
    (getQuiz as jest.Mock).mockResolvedValue(
      mockQuiz({ questions: [{ id: 'q1' }, { id: 'q2' }] })
    );

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
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});

describe('AttemptService - getFailedQuestions (Firestore, out of scope)', () => {
  const userId = 'user-uid';

  test('過去に間違えた問題がない場合は、空配列を返すこと', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [],
    });

    const result = await getFailedQuestions(userId);
    expect(result).toEqual([]);
  });
});

describe('AttemptService - updateFailedQuestions (Firestore, out of scope)', () => {
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
    mockSupabase.rpc.mockResolvedValue({ data: 'lateral-attempt-id', error: null });
  });

  test('未完了 attempt を作成する RPC を正しい引数で呼び出すこと', async () => {
    const attemptId = await createLateralAttemptSession('user-1', 'quiz-lateral-1', ['q-lt-1']);

    expect(attemptId).toBe('lateral-attempt-id');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_start_lateral_attempt', {
      p_user_id: 'user-1',
      p_quiz_id: 'quiz-lateral-1',
      p_total_questions: 1,
      p_ai_turn_limit: 30,
    });
  });

  test('RPC がエラーを返した場合は例外を投げること', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(
      createLateralAttemptSession('user-1', 'quiz-lateral-1', ['q-lt-1'])
    ).rejects.toThrow('DB error');
  });
});

describe('AttemptService - syncPendingAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getQuiz as jest.Mock).mockResolvedValue(
      mockQuiz({ questions: [{ id: 'q1' }, { id: 'q2' }] })
    );
    mockSupabase.rpc.mockResolvedValue({ data: 'synced-attempt-id', error: null });
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
    (getQuiz as jest.Mock).mockResolvedValue(null);

    const successCount = await syncPendingAttempts();

    expect(successCount).toBe(0);
    expect(clearPendingSyncAttempt).not.toHaveBeenCalled();
  });
});
