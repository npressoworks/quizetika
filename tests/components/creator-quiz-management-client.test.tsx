/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CreatorQuizManagementClient } from '@/app/creator/quizzes/creator-quiz-management-client';
import { searchAuthorQuizzes } from '@/services/author-quiz-search';
import { getOpenReportCountsByCreator } from '@/services/review';
import type { Quiz } from '@/types';

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

let mockUser: { id: string } | null = { id: 'author-1' };
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
      expect(screen.getByTestId('creator-quiz-management-loaded')).toBeInTheDocument();
    });

    // 一覧本体はエラー扱いにならない
    expect(
      screen.queryByTestId('creator-quiz-management-error')
    ).not.toBeInTheDocument();
  });
});
