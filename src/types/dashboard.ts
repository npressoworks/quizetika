import { QuestionAnswerDetail, Attempt } from './index';

export type DashboardPeriod = '7d' | '30d' | '90d' | 'all';

export interface PlayerDashboardFilter {
  period: DashboardPeriod;
  genreId?: string;
  tag?: string;
  questionType?: QuestionAnswerDetail['questionType'];
  mode?: Attempt['mode'];
}

export interface TrendPoint {
  label: string;
  plays: number;
  accuracy: number | null;
}

export interface BreakdownItem {
  key: string;
  plays: number;
  accuracy: number | null;
}

export interface PlayerDashboardStats {
  kpi: {
    totalPlays: number;
    averageAccuracy: number;
    averageTimeSeconds: number;
    totalTimeSeconds: number;
    uniqueQuizCount: number;
    streakDays: number;
  };
  trend: TrendPoint[];
  genreBreakdown: BreakdownItem[];
  tagBreakdown: BreakdownItem[];
  modeBreakdown: BreakdownItem[];
  formatBreakdown: BreakdownItem[];
  strengths: BreakdownItem[];
  weaknesses: BreakdownItem[];
  tagCloud: { text: string; plays: number; correct: number; total: number }[];
  titleStats: { title: string; plays: number; correct: number; total: number }[];
}

export interface CreatorDashboardFilter {
  period: DashboardPeriod;
  genreId?: string;
  format?: string;
  visibility?: 'public' | 'followers' | 'private';
}

export interface CreatorDashboardStats {
  kpi: {
    plays: number;
    uniquePlayers: number;
    bookmarksGained: number;
    reviewsGained: number;
    averageRating: number | null;
    completionRate: number | null;
    lifecycleSampleSize: number;
  };
  trend: { label: string; plays: number; bookmarks: number; reviews: number }[];
  quizRanking: {
    quizId: string;
    title: string;
    plays: number;
    averageAccuracy: number | null;
    bookmarks: number;
    reviews: number;
  }[];
  formatBreakdown: BreakdownItem[];
}

export interface QuizAnalysis {
  scoreDistribution: { bucket: string; count: number }[];
  dropoffDistribution: { questionIndex: number; count: number }[];
  completionRate: number | null;
  lifecycleSampleSize: number;
}
