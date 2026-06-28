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

// firebase のモック
jest.mock('@/lib/firebase/config', () => ({
  db: {},
}));

// firestore のモック
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  documentId: jest.fn(() => 'documentId'),
  getDocs: jest.fn().mockResolvedValue({
    docs: [
      {
        id: 'q1',
        data: () => ({ genre: 'genre-1', tags: ['js', 'ts'] }),
      },
    ],
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

// quiz および review サービスのモック (作家ダッシュボード用)
jest.mock('@/services/quiz', () => ({
  getQuizzesByAuthor: jest.fn().mockResolvedValue([]),
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

  it('作家タブをクリックした際、作家ダッシュボード表示に切り替わること', async () => {
    render(<CreatorDashboardClient />);

    // 「作家」タブのクリック
    const creatorTab = screen.getByTestId('dashboard-tab-creator');
    fireEvent.click(creatorTab);

    // 作家ダッシュボードの表示またはローディングを待つ
    await waitFor(() => {
      // getQuizzesByAuthor が空配列を返すため、クイズリストスケルトン等は消えてコンテンツが表示される
      expect(screen.getByTestId('quiz-list-skeleton')).toBeInTheDocument();
    });
  });
});
