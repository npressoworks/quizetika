/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorDashboardClient } from '@/app/creator/dashboard/dashboard-client';

// recharts の ResponsiveContainer をモック
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// next/navigation の useRouter をモック
const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// auth-context のモック
const mockUser = { id: 'user-player-1' };
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

// attempt サービスのモック
jest.mock('@/services/attempt', () => ({
  listUserPlayHistory: jest.fn().mockResolvedValue({
    items: [
      {
        attemptId: 'att-1',
        quizId: 'q1',
        quizTitle: 'クイズ1',
        score: 8,
        totalQuestions: 10,
        mode: 'normal',
        completedAt: new Date('2026-06-28T12:00:00'),
        elapsedSeconds: 120,
      },
    ],
    nextCursor: null,
  }),
}));

// useActiveGenres のモック
jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '' },
    ],
    loading: false,
    genreLabelById: new Map([['genre-1', 'プログラミング']]),
  }),
}));

// quiz および review サービスのモック (クリエイターダッシュボード用)
const mockAuthorQuizzes = [
  {
    id: 'quiz-1',
    title: 'クリエイタークイズ1',
    status: 'published',
    playCount: 10,
    reviewScore: 0.8,
    questions: [{ id: 'q1', questionText: '第一問' }],
  },
];
jest.mock('@/services/quiz', () => ({
  getQuizzesByAuthor: jest.fn(() => Promise.resolve(mockAuthorQuizzes)),
  getQuiz: jest.fn().mockResolvedValue({
    id: 'q1',
    genre: 'genre-1',
    tags: ['js', 'ts'],
  }),
}));
jest.mock('@/services/review', () => ({
  getReportsForCreator: jest.fn().mockResolvedValue([]),
}));

describe('CreatorDashboardClient - 統合ダッシュボードのテスト', () => {
  it('デフォルトでプレイヤーダッシュボードが表示され、データロード後に統計情報と履歴が表示されること', async () => {
    render(<CreatorDashboardClient />);

    // ロード状態のスケルトンが表示される
    expect(screen.getByTestId('player-skeleton')).toBeInTheDocument();

    // ロード完了後の表示を待つ
    await waitFor(() => {
      expect(screen.getByTestId('player-stats')).toBeInTheDocument();
    });

    expect(screen.getByTestId('player-charts')).toBeInTheDocument();
    expect(screen.getByTestId('player-genre-tag-analysis')).toBeInTheDocument();
    expect(screen.getByText('クイズ1')).toBeInTheDocument();
  });

  it('クリエイタータブをクリックした際、クリエイターダッシュボード表示に切り替わること', async () => {
    render(<CreatorDashboardClient />);

    // 「クリエイター」タブのクリック
    const creatorTab = screen.getByTestId('dashboard-tab-creator');
    fireEvent.click(creatorTab);

    // クリエイターダッシュボードの統計セクションが表示されるのを待つ（getQuizzesByAuthor のデータから算出）
    await waitFor(() => {
      expect(screen.getByTestId('stats-section')).toBeInTheDocument();
    });
    expect(screen.getByText('1 個')).toBeInTheDocument();
  });

  it('クリエイターダッシュボードには簡易クイズ一覧の代わりに管理画面への導線カードが表示され、クリックで /creator/quizzes へ遷移すること', async () => {
    render(<CreatorDashboardClient />);

    fireEvent.click(screen.getByTestId('dashboard-tab-creator'));

    const manageLink = await screen.findByTestId('creator-dashboard-manage-quizzes-link');

    // 簡易クイズ一覧セクションはもう表示されない
    expect(screen.queryByTestId('creator-quiz-list')).not.toBeInTheDocument();

    fireEvent.click(manageLink);
    expect(mockRouter.push).toHaveBeenCalledWith('/creator/quizzes');
  });
});
