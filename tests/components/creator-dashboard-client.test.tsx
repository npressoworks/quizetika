/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorDashboardClient } from '../../src/app/creator/dashboard/dashboard-client';
import { getCreatorDashboardStats, getCreatorQuizAnalysis } from '../../src/services/dashboard';
import { getReportsForCreator, resolveReport } from '../../src/services/review';
import { getQuiz } from '../../src/services/quiz';

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-creator-123' },
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
  getCreatorDashboardStats: jest.fn(),
  getCreatorQuizAnalysis: jest.fn(),
}));

jest.mock('../../src/services/review', () => ({
  getReportsForCreator: jest.fn(),
  resolveReport: jest.fn(),
}));

jest.mock('../../src/services/quiz', () => ({
  getQuiz: jest.fn(),
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

describe('CreatorDashboardClient', () => {
  const mockStats = {
    kpi: {
      totalPlays: 10,
      uniquePlayerCount: 5,
      bookmarkCount: 3,
      reviewCount: 2,
      averageRating: 4.5,
      completionRate: 80,
      lifecycleSampleSize: 10,
    },
    trend: [{ label: '7/18', plays: 2, bookmarks: 1, reviews: 1 }],
    quizzes: [
      {
        quizId: 'quiz-1',
        title: 'JavaScriptクイズ',
        plays: 8,
        accuracy: 75,
        bookmarks: 2,
        rating: 4.5,
      },
      {
        quizId: 'quiz-2',
        title: 'Reactクイズ',
        plays: 2,
        accuracy: 90,
        bookmarks: 1,
        rating: 5.0,
      },
    ],
    formatBreakdown: [{ key: 'multiple-choice', plays: 10, accuracy: 80 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('クリエイタータブで統計とランキングを表示すること', async () => {
    (getCreatorDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    (getReportsForCreator as jest.Mock).mockResolvedValue([]);

    render(<CreatorDashboardClient />);

    fireEvent.click(screen.getByTestId('dashboard-tab-creator'));

    expect(screen.getByTestId('creator-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('creator-stats')).toBeInTheDocument();
    });

    expect(screen.getByText('累計プレイ数')).toBeInTheDocument();
    expect(screen.getByText('10 回')).toBeInTheDocument();

    expect(screen.getByText(/指摘報告はありません/)).toBeInTheDocument();

    expect(screen.getByText('JavaScriptクイズ')).toBeInTheDocument();
    expect(screen.getByText('Reactクイズ')).toBeInTheDocument();
  });

  test('完走率の蓄積中バッジ表示', async () => {
    const accumulatingStats = {
      ...mockStats,
      kpi: { ...mockStats.kpi, lifecycleSampleSize: 0, completionRate: null },
    };
    (getCreatorDashboardStats as jest.Mock).mockResolvedValue(accumulatingStats);
    (getReportsForCreator as jest.Mock).mockResolvedValue([]);

    render(<CreatorDashboardClient />);
    fireEvent.click(screen.getByTestId('dashboard-tab-creator'));

    await waitFor(() => {
      expect(screen.getByText('蓄積中')).toBeInTheDocument();
    });
  });

  test('クイズ単体分析ビューへの遷移と、累計値注記の表示', async () => {
    (getCreatorDashboardStats as jest.Mock).mockResolvedValue(mockStats);
    (getReportsForCreator as jest.Mock).mockResolvedValue([]);

    render(<CreatorDashboardClient />);
    fireEvent.click(screen.getByTestId('dashboard-tab-creator'));

    await waitFor(() => {
      expect(screen.getByText('JavaScriptクイズ')).toBeInTheDocument();
    });

    const mockAnalysis = {
      scoreDistribution: [{ bucket: '8-10', count: 5 }],
      dropoffDistribution: [{ questionIndex: 0, count: 2 }],
      completionRate: 80,
      lifecycleSampleSize: 10,
    };
    const mockQuiz = {
      id: 'quiz-1',
      title: 'JavaScriptクイズ',
      questions: [
        {
          id: 'q-1',
          type: 'multiple-choice',
          questionText: 'JSの質問',
          correctCount: 8,
          incorrectCount: 2,
          choices: [
            { id: 'c-1', choiceText: '選択肢A', isCorrect: true, selectedCount: 8 },
            { id: 'c-2', choiceText: '選択肢B', isCorrect: false, selectedCount: 2 },
          ],
        },
      ],
    };

    (getCreatorQuizAnalysis as jest.Mock).mockResolvedValue(mockAnalysis);
    (getQuiz as jest.Mock).mockResolvedValue(mockQuiz);

    fireEvent.click(screen.getByText('JavaScriptクイズ'));

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-analysis')).toBeInTheDocument();
    });

    expect(screen.getByText('累計値（期間フィルタ対象外）')).toBeInTheDocument();
    expect(screen.getByText('選択肢別解答分布')).toBeInTheDocument();
  });
});
