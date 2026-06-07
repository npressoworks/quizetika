/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// sanitize をモックして isomorphic-dompurify の ESM パースエラーを回避
jest.mock('@/lib/security/sanitize', () => ({
  parseMarkdownToHtml: jest.fn((x) => x),
}));

import { QuizResultPageContent } from '@/app/quiz/[id]/result/page';
import { getQuiz, getQuizzesByAuthor } from '@/services/quiz';
import { getBookmarkFeed, toggleBookmark } from '@/services/bookmark';
import { isFollowing, followUser, unfollowUser } from '@/services/user';

// Mock Router
const push = jest.fn();
const replace = jest.fn();
const useSearchParamsGet = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
  }),
  useSearchParams: () => ({
    get: useSearchParamsGet,
  }),
}));

// Mock services
jest.mock('@/services/quiz', () => ({
  getQuiz: jest.fn(),
  getQuizzesByAuthor: jest.fn(),
}));

jest.mock('@/services/bookmark', () => ({
  getBookmarkFeed: jest.fn(),
  toggleBookmark: jest.fn(),
  isBookmarked: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/services/user', () => ({
  isFollowing: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', displayName: 'テストユーザー' },
  }),
}));

jest.mock('@/services/review', () => ({
  submitReview: jest.fn(),
  submitFeedbackReport: jest.fn(),
  getOpenReportsForQuiz: jest.fn().mockResolvedValue([]),
  updateFeedbackReport: jest.fn(),
}));

// Lucide icon mocks
jest.mock('lucide-react', () => ({
  Check: () => <span>Check</span>,
  X: () => <span>X</span>,
  ShieldAlert: () => <span>ShieldAlert</span>,
  Award: () => <span>Award</span>,
  Heart: () => <span>Heart</span>,
  ThumbsUp: () => <span>ThumbsUp</span>,
  ThumbsDown: () => <span>ThumbsDown</span>,
  MessageSquare: () => <span>MessageSquare</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  ArrowLeft: () => <span>ArrowLeft</span>,
  Trophy: () => <span>Trophy</span>,
  CheckCircle: () => <span>CheckCircle</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  Bookmark: () => <span>Bookmark</span>,
  UserPlus: () => <span>UserPlus</span>,
  UserCheck: () => <span>UserCheck</span>,
}));

// Mock Firebase config
jest.mock('@/lib/firebase/config', () => ({
  db: {},
}));

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
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    getDocs: jest.fn(),
    increment: jest.fn((n) => n),
    runTransaction: jest.fn(),
    getDoc: jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        score: 3,
        totalQuestions: 3,
        elapsedSeconds: 45,
        failedQuestionIds: [],
        questionAnswers: [],
      }),
    }),
    updateDoc: jest.fn(),
  };
});

describe('QuizResultPage Component (Phase 12)', () => {
  const quizId = 'test-quiz-123';
  const mockQuiz = {
    id: quizId,
    title: '連想テストクイズ',
    description: 'テスト用クイズ記述',
    authorId: 'author-456',
    authorName: 'クイズ作者',
    difficulty: 3,
    genre: 'programming',
    format: 'association',
    questions: [
      {
        id: 'q-1',
        type: 'association',
        questionText: '第1のヒント問題',
        associationHints: ['ヒントA', 'ヒントB', 'ヒントC'],
        explanation: '連想クイズの解説です。',
      },
    ],
    questionIds: ['q-1'],
    questionCount: 1,
    status: 'published',
  };

  const mockRecommendQuizzes = [
    {
      id: 'quiz-recommend-1',
      title: 'おすすめクイズ1',
      description: 'おすすめ1',
      authorId: 'author-456',
      authorName: 'クイズ作者',
      difficulty: 4,
      genre: 'programming',
      format: 'multiple-choice',
      questionCount: 3,
      reviewScore: 4.5,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useSearchParamsGet.mockImplementation((key) => {
      if (key === 'attemptId') return 'mock-attempt-789';
      return null;
    });

    (getQuiz as jest.Mock).mockResolvedValue(mockQuiz);
    (getQuizzesByAuthor as jest.Mock).mockResolvedValue(mockRecommendQuizzes);
    (getBookmarkFeed as jest.Mock).mockResolvedValue({
      quizzes: [],
      lists: [],
      questions: [],
    });
    (isFollowing as jest.Mock).mockResolvedValue(false);
    localStorage.clear();
  });

  test('結果画面に「もう一度プレイする」ボタンと「作者リンク」が表示されること', async () => {
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByText('クイズ作者')).toBeInTheDocument();
    });

    expect(screen.getByTestId('quiz-replay-btn')).toBeInTheDocument();
  });

  test('連想クイズの表示ヒント履歴が localStorage からロードされて描画されること', async () => {
    const hintsCache = [
      {
        questionId: 'q-1',
        revealedHints: ['ヒントA', 'ヒントB'],
        revealedCount: 2,
      },
    ];
    localStorage.setItem('quizeum_attempt_hints_mock-attempt-789', JSON.stringify(hintsCache));

    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByText(/開示したヒント.*2件/)).toBeInTheDocument();
    });
    expect(screen.getByText(/ヒント.*1:.*ヒントA/)).toBeInTheDocument();
    expect(screen.getByText(/ヒント.*2:.*ヒントB/)).toBeInTheDocument();
  });

  test('同じ作者のおすすめクイズが最大3件取得されて描画されること', async () => {
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByTestId('author-quizzes-section')).toBeInTheDocument();
      expect(screen.getByText('おすすめクイズ1')).toBeInTheDocument();
    });
  });

  test('結果サマリーカードでお気に入りボタンのトグル処理が正しく動作すること', async () => {
    (toggleBookmark as jest.Mock).mockResolvedValue(true);

    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByTestId('quiz-result-bookmark-btn')).toBeInTheDocument();
    });

    const bookmarkBtn = screen.getByTestId('quiz-result-bookmark-btn');
    fireEvent.click(bookmarkBtn);

    await waitFor(() => {
      expect(toggleBookmark).toHaveBeenCalledWith('test-user-id', quizId, 'quiz');
    });
  });

  test('クイズ全体の指摘モーダルで、指摘カテゴリから「別解の追加要望」が除外されていること', async () => {
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByText('クイズ全体の指摘')).toBeInTheDocument();
    });

    const reportBtn = screen.getByText('クイズ全体の指摘');
    fireEvent.click(reportBtn);

    // モーダルオープン後、指摘カテゴリセレクトボックスを検査
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).map(opt => opt.value);
    expect(options).toContain('typo');
    expect(options).toContain('fact');
    expect(options).not.toContain('alternative');
  });

  test('「クイズを通報」ボタンをクリックした際、通報モーダルが表示されること', async () => {
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByTestId('quiz-report-btn')).toBeInTheDocument();
    });

    const reportBtn = screen.getByTestId('quiz-report-btn');
    fireEvent.click(reportBtn);

    await waitFor(() => {
      expect(screen.getByTestId('report-modal-content')).toBeInTheDocument();
    });
  });

  test('自分以外の作者のクイズ結果画面の場合、フォローボタンが表示され、初期状態が取得されること', async () => {
    (isFollowing as jest.Mock).mockResolvedValue(false);
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByTestId('author-follow-btn')).toBeInTheDocument();
      expect(screen.getByText('フォロー')).toBeInTheDocument();
    });
    expect(isFollowing).toHaveBeenCalledWith('test-user-id', 'author-456');
  });

  test('すでにフォロー中の場合、フォローボタンが「フォロー中」表示になること', async () => {
    (isFollowing as jest.Mock).mockResolvedValue(true);
    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.getByTestId('author-follow-btn')).toBeInTheDocument();
      expect(screen.getByText('フォロー中')).toBeInTheDocument();
    });
  });

  test('自分自身のクイズ結果画面の場合、フォローボタンが表示されないこと', async () => {
    const myQuiz = { ...mockQuiz, authorId: 'test-user-id' };
    (getQuiz as jest.Mock).mockResolvedValue(myQuiz);

    render(<QuizResultPageContent quizId={quizId} />);

    await waitFor(() => {
      expect(screen.queryByTestId('author-follow-btn')).not.toBeInTheDocument();
    });
  });
});
