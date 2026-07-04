import {
  submitReview,
  retractReview,
  getUserReviewForQuiz,
  submitFeedbackReport,
  getOpenReportsByQuizId,
  resolveReport,
  rejectReport,
} from '../../src/services/review';

// チェーン用のモックヘルパー（bookmark.test.ts と同様のパターン）
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    single: jest.fn(() => Promise.resolve(resolveValue)),
    then: jest.fn((onFulfilled: any) => {
      return Promise.resolve(resolveValue).then(onFulfilled);
    }),
  };
  return chain;
};

jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    in: jest.fn(() => mock),
    order: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

jest.mock('@/services/notification', () => ({
  createNotification: jest.fn(),
}));
import { createNotification } from '@/services/notification';

describe('ReviewService - submitReview', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';
  const authorId = 'author-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  test('作成者自身の投票はエラーになること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: { author_id: authorId }, error: null });
      }
      return mockSupabase;
    });

    await expect(submitReview(quizId, authorId, 'positive')).rejects.toThrow(
      'クイズの作成者は評価できません'
    );

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  test('クイズが存在しない場合はエラーになること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: null, error: null });
      }
      return mockSupabase;
    });

    await expect(submitReview(quizId, reviewerId, 'positive')).rejects.toThrow(
      `クイズが見つかりません: ${quizId}`
    );
  });

  test('新規投票のとき、handle_submit_review RPCが正しい引数で呼び出されること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: { author_id: authorId }, error: null });
      }
      return mockSupabase;
    });
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await submitReview(quizId, reviewerId, 'positive', '良い問題でした');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_submit_review', {
      p_reviewer_id: reviewerId,
      p_quiz_id: quizId,
      p_type: 'positive',
      p_reason: '良い問題でした',
    });
  });

  test('reason省略時はnullがRPCに渡されること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: { author_id: authorId }, error: null });
      }
      return mockSupabase;
    });
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await submitReview(quizId, reviewerId, 'negative');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_submit_review', {
      p_reviewer_id: reviewerId,
      p_quiz_id: quizId,
      p_type: 'negative',
      p_reason: null,
    });
  });

  test('同一の評価を再送信してもエラーにならず完了すること（冪等性はRPC側=DB関数で保証）', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: { author_id: authorId }, error: null });
      }
      return mockSupabase;
    });
    // RPC側は同一票の場合、副作用なしで正常終了する（no-op）
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await expect(submitReview(quizId, reviewerId, 'positive')).resolves.toBeUndefined();
    await expect(submitReview(quizId, reviewerId, 'positive')).resolves.toBeUndefined();

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });

  test('RPCがエラーを返した場合、例外を投げること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: { author_id: authorId }, error: null });
      }
      return mockSupabase;
    });
    mockSupabase.rpc.mockResolvedValue({ error: { message: 'DB error' } });

    await expect(submitReview(quizId, reviewerId, 'positive')).rejects.toThrow(
      'レビューの投稿に失敗しました'
    );
  });
});

describe('ReviewService - retractReview', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handle_retract_review RPCが正しい引数で呼び出されること', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await retractReview(quizId, reviewerId);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_retract_review', {
      p_reviewer_id: reviewerId,
      p_quiz_id: quizId,
    });
  });

  test('投票が存在しない場合でもエラーにならないこと（RPC側でno-op）', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await expect(retractReview(quizId, reviewerId)).resolves.toBeUndefined();
  });

  test('RPCがエラーを返した場合、例外を投げること', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: { message: 'DB error' } });

    await expect(retractReview(quizId, reviewerId)).rejects.toThrow(
      'レビューの取り消しに失敗しました'
    );
  });
});

describe('ReviewService - getUserReviewForQuiz', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
  });

  test('投票履歴が存在しない場合、nullを返すこと', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quiz_reviews') {
        return createChainMock({ data: null, error: null });
      }
      return mockSupabase;
    });

    const result = await getUserReviewForQuiz(quizId, reviewerId);
    expect(result).toBeNull();
  });

  test('投票履歴が存在する場合、投票タイプを返すこと', async () => {
    const chain = createChainMock({ data: { type: 'positive' }, error: null });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quiz_reviews') {
        return chain;
      }
      return mockSupabase;
    });

    const result = await getUserReviewForQuiz(quizId, reviewerId);
    expect(result).toBe('positive');

    expect(mockSupabase.from).toHaveBeenCalledWith('quiz_reviews');
    expect(chain.eq).toHaveBeenCalledWith('reviewer_id', reviewerId);
    expect(chain.eq).toHaveBeenCalledWith('quiz_id', quizId);
  });
});

describe('ReviewService - submitFeedbackReport', () => {
  const mockReport = {
    quizId: 'quiz-uid',
    quizTitle: 'テストクイズタイトル',
    questionId: 'question-uid',
    questionText: '問題文',
    reporterId: 'reporter-uid',
    creatorId: 'creator-uid',
    category: 'typo' as const,
    content: '誤字があります。',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('指摘が送信された際、レポートが登録されクイズ作成者宛ての通知が作成されること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        // 事前のEXISTS判定: 既存のopenレポートなし → insert実行
        return createChainMock({ data: null, error: null });
      }
      if (table === 'users') {
        return createChainMock({
          data: { display_name: '指摘ユーザー', avatar_url: 'avatar-url' },
          error: null,
        });
      }
      return mockSupabase;
    });

    await submitFeedbackReport(mockReport);

    expect(mockSupabase.from).toHaveBeenCalledWith('feedback_reports');
    expect(createNotification).toHaveBeenCalledWith({
      userId: mockReport.creatorId,
      type: 'correction_reported',
      senderId: mockReport.reporterId,
      senderName: '指摘ユーザー',
      senderAvatar: 'avatar-url',
      targetId: mockReport.quizId,
      targetTitle: mockReport.quizTitle,
    });
  });

  test('指摘送信者と作成者が同一の場合は通知が作成されないこと', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        return createChainMock({ data: null, error: null });
      }
      return mockSupabase;
    });

    const selfReport = { ...mockReport, reporterId: 'creator-uid' };
    await submitFeedbackReport(selfReport);

    expect(createNotification).not.toHaveBeenCalled();
  });

  test('同一 (quiz_id, question_id, reporter_id) で既にopenの指摘が存在する場合、重複登録されないこと（冪等）', async () => {
    const insertMock = jest.fn();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        const chain: any = createChainMock({
          data: { id: 'existing-report-id' }, // 既存のopenレポートあり
          error: null,
        });
        chain.insert = insertMock.mockReturnValue(chain);
        return chain;
      }
      return mockSupabase;
    });

    await submitFeedbackReport(mockReport);

    expect(insertMock).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe('ReviewService - getOpenReportsByQuizId', () => {
  const quizId = 'test-quiz-id';
  const mockReports = [
    {
      id: 'report-1',
      quiz_id: quizId,
      quiz_title: 'クイズA',
      question_id: 'q-1',
      question_text: '問題1',
      reporter_id: 'reporter-1',
      creator_id: 'creator-uid-123',
      category: 'typo',
      content: '指摘1',
      status: 'open',
      created_at: new Date('2026-06-01').toISOString(),
    },
    {
      id: 'report-2',
      quiz_id: quizId,
      quiz_title: 'クイズA',
      question_id: 'q-2',
      question_text: '問題2',
      reporter_id: 'reporter-2',
      creator_id: 'creator-uid-123',
      category: 'fact',
      content: '指摘2',
      status: 'open',
      created_at: new Date('2026-06-02').toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('指定したクイズIDの未解決の指摘一覧が取得できること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        return createChainMock({ data: mockReports, error: null });
      }
      return mockSupabase;
    });

    const result = await getOpenReportsByQuizId(quizId, 'creator-uid-123');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('report-1');
    expect(result[0].quizId).toBe(quizId);
    expect(result[1].id).toBe('report-2');
  });
});

describe('ReviewService - resolveReport', () => {
  const reportId = 'test-report-id';
  const mockReportRow = {
    id: reportId,
    reporter_id: 'reporter-uid',
    creator_id: 'creator-uid',
    quiz_id: 'quiz-uid',
    quiz_title: 'テストクイズタイトル',
    question_id: 'question-uid',
    question_text: '問題文',
    category: 'typo',
    content: '内容',
    status: 'open',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('指摘が解決済み（resolved）に更新され、報告者への通知が正しいスキーマで作成されること', async () => {
    const updateMock = jest.fn();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        const chain: any = createChainMock({ data: mockReportRow, error: null });
        updateMock.mockReturnValue(chain);
        chain.update = updateMock;
        return chain;
      }
      return mockSupabase;
    });

    await resolveReport(reportId);

    expect(updateMock).toHaveBeenCalledWith({ status: 'resolved' });
    expect(createNotification).toHaveBeenCalledWith({
      userId: mockReportRow.reporter_id,
      type: 'correction_resolved',
      senderId: 'system',
      senderName: '運営',
      senderAvatar: '',
      targetId: mockReportRow.quiz_id,
      targetTitle: mockReportRow.quiz_title,
    });
  });

  test('存在しないレポートIDの場合はエラーになること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        return createChainMock({ data: null, error: null });
      }
      return mockSupabase;
    });

    await expect(resolveReport('missing-id')).rejects.toThrow(
      'レポートが見つかりません: missing-id'
    );
  });
});

describe('ReviewService - rejectReport', () => {
  const reportId = 'test-report-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('指摘が却下（rejected）に更新され、通知は追加されないこと', async () => {
    const updateMock = jest.fn();
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        const chain: any = createChainMock({ data: { id: reportId }, error: null });
        updateMock.mockReturnValue(chain);
        chain.update = updateMock;
        return chain;
      }
      return mockSupabase;
    });

    await rejectReport(reportId);

    expect(updateMock).toHaveBeenCalledWith({ status: 'rejected' });
    expect(createNotification).not.toHaveBeenCalled();
  });

  test('存在しないレポートIDの場合はエラーになること', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'feedback_reports') {
        return createChainMock({ data: null, error: null });
      }
      return mockSupabase;
    });

    await expect(rejectReport('missing-id')).rejects.toThrow(
      'レポートが見つかりません: missing-id'
    );
  });
});
