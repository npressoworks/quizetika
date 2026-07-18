/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerDashboardClient } from '../../src/app/creator/dashboard/player-dashboard-client';
import { getPlayerDashboardStats, getPlayerDrilldownHistory, getAttemptDetail } from '../../src/services/dashboard';

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
    loading: false,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [],
    genreLabelById: new Map(),
    loading: false,
  }),
}));

jest.mock('../../src/services/dashboard', () => ({
  getPlayerDashboardStats: jest.fn(),
  getPlayerDrilldownHistory: jest.fn(),
  getAttemptDetail: jest.fn(),
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

describe('PlayerDashboardClient & PlayerDrilldown', () => {
  const mockStats = {
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
    titleStats: [{ title: 'テストクイズ', plays: 2, correct: 2, total: 2 }],
  };

  const mockHistory = {
    items: [
      {
        id: 'attempt-1',
        quizId: 'quiz-1',
        quizTitle: 'テストクイズ',
        score: 5,
        totalQuestions: 5,
        mode: 'normal' as const,
        completedAt: '2026-07-18T12:00:00Z',
        elapsedSeconds: 15,
      },
    ],
    nextCursor: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('初期ロード時にデータを取得し、ダッシュボードを表示すること', async () => {
    (getPlayerDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    (getPlayerDrilldownHistory as jest.Mock).mockResolvedValue(mockHistory);

    render(<PlayerDashboardClient />);

    expect(screen.getByTestId('player-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('player-stats')).toBeInTheDocument();
    });

    expect(screen.getByText('累計プレイ数')).toBeInTheDocument();
    expect(screen.getByText('5 回')).toBeInTheDocument();
  });

  test('データが0件のときに空状態が表示されること', async () => {
    const emptyStats = {
      ...mockStats,
      kpi: { ...mockStats.kpi, totalPlays: 0 },
    };
    (getPlayerDashboardStats as jest.Mock).mockResolvedValue(emptyStats);
    (getPlayerDrilldownHistory as jest.Mock).mockResolvedValue({ items: [], nextCursor: undefined });

    render(<PlayerDashboardClient />);

    await waitFor(() => {
      expect(screen.getByTestId('player-empty')).toBeInTheDocument();
    });
  });

  test('エラー発生時に再試行ボタンが表示され、クリックで再ロードされること', async () => {
    (getPlayerDashboardStats as jest.Mock).mockRejectedValueOnce(new Error('APIエラー'));
    (getPlayerDrilldownHistory as jest.Mock).mockResolvedValue(mockHistory);

    render(<PlayerDashboardClient />);

    await waitFor(() => {
      expect(screen.getByTestId('player-error')).toBeInTheDocument();
    });

    (getPlayerDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    fireEvent.click(screen.getByText('再試行'));

    await waitFor(() => {
      expect(screen.getByTestId('player-stats')).toBeInTheDocument();
    });
  });

  test('ドリルダウンと明細表示の往復と、詳細データなし注記の動作', async () => {
    (getPlayerDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    (getPlayerDrilldownHistory as jest.Mock).mockResolvedValue(mockHistory);

    render(<PlayerDashboardClient />);

    await waitFor(() => {
      expect(screen.getByTestId('show-drilldown-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('show-drilldown-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('player-drilldown')).toBeInTheDocument();
    });

    (getAttemptDetail as jest.Mock).mockResolvedValue({
      summary: mockHistory.items[0],
      details: null,
    });

    fireEvent.click(screen.getByTestId('view-detail-btn-attempt-1'));

    await waitFor(() => {
      expect(screen.getByTestId('attempt-detail-view')).toBeInTheDocument();
      expect(screen.getByTestId('no-detail-note')).toBeInTheDocument();
    });
  });
});
