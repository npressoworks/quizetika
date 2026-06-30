import { runTransaction, doc, getDoc, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import {
  submitReview,
  getReviewStats,
  submitReviewResetRequest,
  resetReviews,
  resolveReport,
  getOpenReportsByQuizId,
  rejectReport,
  getUserReviewForQuiz,
  submitFeedbackReport,
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
    addDoc: jest.fn(),
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

describe('ReviewService - resolveReport', () => {
  const reportId = 'test-report-id';
  const mockReport = {
    reporterId: 'reporter-uid',
    creatorId: 'creator-uid',
    quizId: 'quiz-uid',
    quizTitle: 'テストクイズタイトル',
    status: 'open',
  };

  test('指摘が解決済み（resolved）に更新され、正しいスキーマで通知が追加されること', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => mockReport,
    });

    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (addDoc as jest.Mock).mockResolvedValue({ id: 'new-notif-id' });

    await resolveReport(reportId, '修正を行いました。');

    // 1. 指摘のステータス更新検証
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: reportId }),
      expect.objectContaining({ status: 'resolved' })
    );

    // 2. 通知の追加検証 (正しいスキーマ仕様)
    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: mockReport.reporterId, // recipientId ではなく userId であること
        type: 'correction_resolved', // report_resolved ではなく correction_resolved であること
        targetId: mockReport.quizId, // quizId ではなく targetId であること
        targetTitle: mockReport.quizTitle, // quizTitle ではなく targetTitle であること
        resolverNote: '修正を行いました。',
        senderId: 'system',
        senderName: '運営',
        senderAvatar: '',
        isRead: false,
      })
    );
  });
});

describe('ReviewService - rejectReport', () => {
  const reportId = 'test-report-id';
  const mockReport = {
    reporterId: 'reporter-uid',
    creatorId: 'creator-uid',
    quizId: 'quiz-uid',
    quizTitle: 'テストクイズタイトル',
    status: 'open',
  };

  test('指摘が却下（rejected）に更新され、通知は追加されないこと', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => mockReport,
    });

    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (addDoc as jest.Mock).mockClear();

    await rejectReport(reportId);

    // 1. 指摘のステータス更新検証
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: reportId }),
      expect.objectContaining({ status: 'rejected' })
    );

    // 2. 通知は追加されないことを検証
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('ReviewService - getOpenReportsByQuizId', () => {
  const quizId = 'test-quiz-id';
  const mockReports = [
    { id: 'report-1', quizId, status: 'open', content: '指摘1' },
    { id: 'report-2', quizId, status: 'open', content: '指摘2' },
  ];

  test('指定したクイズIDの未解決の指摘一覧が取得できること', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: mockReports.map(r => ({
        id: r.id,
        data: () => r
      }))
    });

    const result = await getOpenReportsByQuizId(quizId, 'creator-uid-123');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('report-1');
    expect(result[1].id).toBe('report-2');
  });
});

describe('ReviewService - getUserReviewForQuiz', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';

  test('投票履歴が存在しない場合、nullを返すこと', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });

    const result = await getUserReviewForQuiz(quizId, reviewerId);
    expect(result).toBeNull();
  });

  test('投票履歴が存在する場合、投票タイプを返すこと', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ type: 'positive' }),
    });

    const result = await getUserReviewForQuiz(quizId, reviewerId);
    expect(result).toBe('positive');
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

  test('指摘が送信された際、クイズ作成者宛ての通知が正しいスキーマで追加されること', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ displayName: '指摘ユーザー', avatarUrl: 'avatar-url' }),
    });

    (addDoc as jest.Mock).mockResolvedValue({ id: 'new-report-id' });

    await submitFeedbackReport(mockReport);

    // 1. 指摘レポート自体の登録
    expect(addDoc).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        quizId: mockReport.quizId,
        reporterId: mockReport.reporterId,
        status: 'open',
      })
    );

    // 2. 作成者への通知作成
    expect(addDoc).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        userId: mockReport.creatorId,
        type: 'correction_reported',
        senderId: mockReport.reporterId,
        senderName: '指摘ユーザー',
        senderAvatar: 'avatar-url',
        targetId: mockReport.quizId,
        targetTitle: mockReport.quizTitle,
        isRead: false,
      })
    );
  });

  test('指摘送信者と作成者が同一の場合は通知が作成されないこと', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ displayName: '作者ユーザー', avatarUrl: 'avatar-url' }),
    });

    (addDoc as jest.Mock).mockResolvedValue({ id: 'new-report-id' });

    const selfReport = {
      ...mockReport,
      reporterId: 'creator-uid',
    };

    await submitFeedbackReport(selfReport);

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reporterId: 'creator-uid',
      })
    );
  });
});

describe('ReviewService - submitReview warning notification', () => {
  const quizId = 'test-quiz-id';
  const reviewerId = 'voter-uid';
  const authorId = 'author-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('評価が「要改善」以下に低下した際、作成者宛てに警告通知が追加されること', async () => {
    const mockQuizSnap = {
      exists: () => true,
      data: () => ({
        authorId,
        title: 'テストクイズ',
        positiveCount: 6,
        negativeCount: 4,
        isReviewMasked: false,
        reviewBadge: '普通',
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

    (runTransaction as jest.Mock).mockImplementation((db, callback) => callback(mockTransaction));
    (addDoc as jest.Mock).mockResolvedValue({ id: 'new-notif-id' });

    await submitReview(quizId, reviewerId, 'negative');

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: authorId,
        type: 'quiz_review_warning',
        targetId: quizId,
        targetTitle: 'テストクイズ',
      })
    );
  });
});



