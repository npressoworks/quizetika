/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および pointer capture 関連 API を実装していないため、
// Select コンポーネントが内部で使用するイベント生成・API 呼び出しに失敗する。
// tests/components/creator-quiz-visibility-toggle.test.tsx と同じポリフィルを注入する。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CreatorQuizManagementClient } from '@/app/creator/quizzes/creator-quiz-management-client';
import { searchAuthorQuizzes } from '@/services/author-quiz-search';
import { getOpenReportCountsByCreator } from '@/services/review';
import { updateQuiz } from '@/services/quiz';
import type { Quiz } from '@/types';

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

let mockUser: { id: string; subscriptionTier?: string; subscriptionStatus?: string } | null = {
  id: 'author-1',
};
let mockAuthLoading = false;
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: mockAuthLoading }),
}));

jest.mock('@/services/author-quiz-search', () => ({
  searchAuthorQuizzes: jest.fn(),
}));

jest.mock('@/services/review', () => ({
  getOpenReportCountsByCreator: jest.fn(),
}));

jest.mock('@/services/quiz', () => ({
  updateQuiz: jest.fn(),
  listActiveGenres: jest.fn().mockResolvedValue([]),
}));

const mockedUpdateQuiz = updateQuiz as jest.MockedFunction<typeof updateQuiz>;

const mockedSearchAuthorQuizzes = searchAuthorQuizzes as jest.MockedFunction<
  typeof searchAuthorQuizzes
>;
const mockedGetOpenReportCountsByCreator =
  getOpenReportCountsByCreator as jest.MockedFunction<
    typeof getOpenReportCountsByCreator
  >;

const sampleQuiz = {
  id: 'quiz-1',
  title: 'サンプルクイズ',
  description: '説明',
  status: 'published',
  visibility: 'public',
  genre: 'genre-1',
  canonicalGenreId: 'genre-1',
  tags: [],
  playCount: 3,
  createdAt: new Date('2026-01-01'),
} as unknown as Quiz;

describe('CreatorQuizManagementClient - データ取得・状態管理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'author-1' };
    mockAuthLoading = false;
    mockedSearchAuthorQuizzes.mockResolvedValue({
      quizzes: [sampleQuiz],
      questionsByQuizId: {},
    });
    mockedGetOpenReportCountsByCreator.mockResolvedValue({ 'quiz-1': 2 });
  });

  it('未認証ユーザーの場合、復帰クエリ付きでログイン画面へリダイレクトすること', async () => {
    mockUser = null;
    mockAuthLoading = false;

    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/login?redirect=/creator/quizzes'
      );
    });
    expect(mockedSearchAuthorQuizzes).not.toHaveBeenCalled();
  });

  it('認証済みユーザーの場合、authorId・includeDrafts: true・デフォルト並び替え（作成日・新しい順）でクイズ一覧を取得すること', async () => {
    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(mockedSearchAuthorQuizzes).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: 'author-1',
          includeDrafts: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
      );
    });

    expect(mockedGetOpenReportCountsByCreator).toHaveBeenCalledWith('author-1');
  });

  it('クイズ一覧の取得に失敗した場合、エラー状態を表示し、再試行操作で再取得すること', async () => {
    mockedSearchAuthorQuizzes.mockRejectedValueOnce(new Error('network error'));

    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-management-error')).toBeInTheDocument();
    });

    // 再試行後は成功レスポンスを返すようモックを差し替え済みなので、成功状態になること
    mockedSearchAuthorQuizzes.mockResolvedValueOnce({
      quizzes: [sampleQuiz],
      questionsByQuizId: {},
    });

    fireEvent.click(screen.getByTestId('creator-quiz-management-retry'));

    await waitFor(() => {
      expect(mockedSearchAuthorQuizzes).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('creator-quiz-management-error')
      ).not.toBeInTheDocument();
    });
  });

  it('未解決指摘件数の取得のみ失敗した場合、一覧本体はブロックされず表示され続けること', async () => {
    mockedGetOpenReportCountsByCreator.mockRejectedValueOnce(
      new Error('report count fetch failed')
    );

    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-management-page')).toBeInTheDocument();
    });

    // 一覧本体はエラー扱いにならない
    expect(
      screen.queryByTestId('creator-quiz-management-error')
    ).not.toBeInTheDocument();
  });

  it('未解決指摘件数バッジをクリックすると、該当クイズの編集画面へ実際に画面遷移すること', async () => {
    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-report-badge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('creator-quiz-report-badge'));

    expect(mockRouter.push).toHaveBeenCalledWith(`/quiz/${sampleQuiz.id}/edit`);
  });

  it('読み込み完了後、実際の一覧セクション（CreatorQuizManagementSections）が描画されること', async () => {
    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-management-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('creator-quiz-management-list')).toBeInTheDocument();
    expect(
      screen.getByTestId(`creator-quiz-management-row-${sampleQuiz.id}`)
    ).toBeInTheDocument();
  });

  it('公開範囲切り替え操作を行うと、該当行の統合ステータス表示のみが即時更新され、一覧・指摘件数の再取得は行われないこと', async () => {
    mockUser = {
      id: 'author-1',
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    };
    mockedUpdateQuiz.mockResolvedValue(undefined);

    render(<CreatorQuizManagementClient />);

    await waitFor(() => {
      expect(
        screen.getByTestId('creator-quiz-status-public')
      ).toBeInTheDocument();
    });

    expect(mockedSearchAuthorQuizzes).toHaveBeenCalledTimes(1);
    expect(mockedGetOpenReportCountsByCreator).toHaveBeenCalledTimes(1);

    const toggle = screen.getByTestId('creator-quiz-visibility-toggle');
    fireEvent.click(toggle);
    const privateOption = await screen.findByTestId(
      'creator-quiz-visibility-toggle-option-private'
    );
    fireEvent.keyDown(privateOption, { key: 'Enter' });

    await waitFor(() => {
      expect(mockedUpdateQuiz).toHaveBeenCalledWith('quiz-1', {
        visibility: 'private',
      });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('creator-quiz-status-private')
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('creator-quiz-status-public')
    ).not.toBeInTheDocument();
    expect(mockedSearchAuthorQuizzes).toHaveBeenCalledTimes(1);
    expect(mockedGetOpenReportCountsByCreator).toHaveBeenCalledTimes(1);
  });
});
