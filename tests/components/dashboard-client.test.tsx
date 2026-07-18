/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorDashboardClient } from '@/app/creator/dashboard/dashboard-client';
import { getPlayerDashboardStats, getPlayerDrilldownHistory, getCreatorDashboardStats } from '@/services/dashboard';
import { getReportsForCreator } from '@/services/review';

jest.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    LineChart: ({ children }: any) => <div>{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
  };
});

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockUser = { id: 'user-player-1' };
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '' },
    ],
    loading: false,
    genreLabelById: new Map([['genre-1', 'プログラミング']]),
  }),
}));

jest.mock('@/services/dashboard', () => ({
  getPlayerDashboardStats: jest.fn(),
  getPlayerDrilldownHistory: jest.fn(),
  getCreatorDashboardStats: jest.fn(),
}));

jest.mock('@/components/charts/selection-pie', () => ({
  SelectionPie: () => <div data-testid="mock-selection-pie" />,
}));

jest.mock('@/components/charts/analytics-chart', () => ({
  AnalyticsChart: () => <div data-testid="mock-analytics-chart" />,
}));

jest.mock('@/components/charts/word-cloud', () => ({
  WordCloud: () => <div data-testid="mock-word-cloud" />,
}));

jest.mock('@/services/review', () => ({
  getReportsForCreator: jest.fn(),
  resolveReport: jest.fn(),
}));

const mockPlayerStats = {
  kpi: {
    totalPlays: 5,
    averageAccuracy: 80,
    averageTimeSeconds: 15,
    totalTimeSeconds: 75,
    uniqueQuizCount: 3,
    streakDays: 2,
  },
  trend: [
    { label: '7/18', plays: 1, accuracy: 80 },
  ],
  genreBreakdown: [{ key: 'genre-1', plays: 3, accuracy: 80 }],
  tagBreakdown: [{ key: 'tag-1', plays: 2, accuracy: 100 }],
  modeBreakdown: [{ key: 'normal', plays: 5, accuracy: 80 }],
  formatBreakdown: [{ key: 'multiple-choice', plays: 5, accuracy: 80 }],
  strengths: [{ key: 'genre-1', plays: 3, accuracy: 80 }],
  weaknesses: [],
  tagCloud: [{ text: 'tag-1', plays: 2, correct: 2, total: 2 }],
  titleStats: [{ title: 'クイズ1', plays: 2, correct: 2, total: 2 }],
};

const mockPlayerHistory = {
  items: [
    {
      id: 'att-1',
      quizId: 'q1',
      quizTitle: 'クイズ1',
      score: 8,
      totalQuestions: 10,
      mode: 'normal',
      completedAt: '2026-06-28T12:00:00Z',
      elapsedSeconds: 120,
    },
  ],
  nextCursor: null,
};

const mockCreatorStats = {
  kpi: {
    plays: 10,
    uniquePlayers: 5,
    bookmarksGained: 3,
    reviewsGained: 2,
    averageRating: 4.5,
    completionRate: 80,
    lifecycleSampleSize: 10,
  },
  trend: [{ label: '7/18', plays: 2, bookmarks: 1, reviews: 1 }],
  quizRanking: [
    {
      quizId: 'quiz-1',
      title: 'クリエイタークイズ1',
      plays: 8,
      averageAccuracy: 75,
      bookmarks: 2,
      reviews: 2,
    },
  ],
  formatBreakdown: [{ key: 'multiple-choice', plays: 10, accuracy: 80 }],
};

describe('CreatorDashboardClient - 統合ダッシュボードのテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPlayerDashboardStats as jest.Mock).mockResolvedValue(mockPlayerStats);
    (getPlayerDrilldownHistory as jest.Mock).mockResolvedValue(mockPlayerHistory);
    (getCreatorDashboardStats as jest.Mock).mockResolvedValue(mockCreatorStats);
    (getReportsForCreator as jest.Mock).mockResolvedValue([]);
  });

  it('デフォルトでプレイヤーダッシュボードが表示され、データロード後に統計情報と履歴が表示されること', async () => {
    render(<CreatorDashboardClient />);

    expect(screen.getByTestId('player-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('player-stats')).toBeInTheDocument();
    });

    expect(screen.getByTestId('player-charts')).toBeInTheDocument();
    expect(screen.getByTestId('player-word-cloud')).toBeInTheDocument();
    expect(screen.getByTestId('player-genre-tag-analysis')).toBeInTheDocument();
    expect(screen.getByText('クイズ1')).toBeInTheDocument();
  });

  it('クリエイタータブをクリックした際、クリエイターダッシュボード表示に切り替わること', async () => {
    render(<CreatorDashboardClient />);

    const creatorTab = screen.getByTestId('dashboard-tab-creator');
    fireEvent.click(creatorTab);

    await waitFor(() => {
      expect(screen.getByTestId('stats-section')).toBeInTheDocument();
    });

    expect(screen.getByText('10 回')).toBeInTheDocument();
  });

  it('クリエイターダッシュボードには管理画面への導線カードが表示され、クリックで /creator/quizzes へ遷移すること', async () => {
    render(<CreatorDashboardClient />);

    fireEvent.click(screen.getByTestId('dashboard-tab-creator'));

    const manageLink = await screen.findByTestId('creator-dashboard-manage-quizzes-link');

    expect(screen.queryByTestId('creator-quiz-list')).not.toBeInTheDocument();

    fireEvent.click(manageLink);
    expect(mockRouter.push).toHaveBeenCalledWith('/creator/quizzes');
  });
});
