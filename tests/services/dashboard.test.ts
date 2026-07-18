import { createClient } from '../../src/lib/supabase/client';
import {
  getPlayerDashboardStats,
  getPlayerDrilldownHistory,
  getAttemptDetail,
  getCreatorDashboardStats,
  getCreatorQuizAnalysis,
} from '../../src/services/dashboard';

// Supabase クライアントを Mock する
jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    maybeSingle: jest.fn(),
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

const mockSupabase = createClient() as any;

describe('DashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlayerDashboardStats', () => {
    test('get_player_dashboard_stats RPC を正しくパラメータを渡して呼び出すこと', async () => {
      const mockResult = { kpi: { totalPlays: 10 } };
      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const filter = {
        period: '7d' as const,
        genreId: 'genre-uuid',
        tag: 'history',
        questionType: 'multiple-choice' as const,
        mode: 'normal' as const,
      };

      const result = await getPlayerDashboardStats(filter);
      expect(result).toEqual(mockResult);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_player_dashboard_stats', {
        p_period: '7d',
        p_genre_id: 'genre-uuid',
        p_tag: 'history',
        p_question_type: 'multiple-choice',
        p_mode: 'normal',
      });
    });

    test('RPC エラー時に例外をスローすること', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'エラー' } });

      await expect(
        getPlayerDashboardStats({ period: '30d' })
      ).rejects.toThrow('統計情報の取得に失敗しました: エラー');
    });
  });

  describe('getPlayerDrilldownHistory', () => {
    test('get_player_drilldown_history RPC を正しく呼び出すこと', async () => {
      const mockResult = { items: [], nextCursor: null };
      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const filter = { period: 'all' as const };
      const result = await getPlayerDrilldownHistory(filter, 'cursor-123', 10);

      expect(result).toEqual(mockResult);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_player_drilldown_history', {
        p_period: 'all',
        p_genre_id: null,
        p_tag: null,
        p_question_type: null,
        p_mode: null,
        p_cursor: 'cursor-123',
        p_limit: 10,
      });
    });
  });

  describe('getAttemptDetail', () => {
    test('attempts テーブルからデータを取得して整形すること', async () => {
      const mockRow = {
        id: 'attempt-uuid',
        user_id: 'user-uuid',
        quiz_id: 'quiz-uuid',
        score: 3,
        total_questions: 5,
        mode: 'normal',
        completed_at: '2026-07-26T00:00:00Z',
        elapsed_seconds: 120,
        question_answer_details: [
          { questionId: 'q1', isCorrect: true, elapsedSeconds: 24, questionType: 'multiple-choice' }
        ],
        quizzes: { title: 'テストクイズ' }
      };

      mockSupabase.maybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const result = await getAttemptDetail('attempt-uuid');

      expect(mockSupabase.from).toHaveBeenCalledWith('attempts');
      expect(mockSupabase.select).toHaveBeenCalledWith('*, quizzes(title)');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'attempt-uuid');

      expect(result).toEqual({
        summary: {
          id: 'attempt-uuid',
          quizId: 'quiz-uuid',
          quizTitle: 'テストクイズ',
          score: 3,
          totalQuestions: 5,
          mode: 'normal',
          completedAt: '2026-07-26T00:00:00Z',
          elapsedSeconds: 120,
        },
        details: [
          { questionId: 'q1', isCorrect: true, elapsedSeconds: 24, questionType: 'multiple-choice' }
        ],
      });
    });

    test('明細がない旧試行は details: null を返すこと', async () => {
      const mockRow = {
        id: 'attempt-uuid',
        user_id: 'user-uuid',
        quiz_id: 'quiz-uuid',
        score: 3,
        total_questions: 5,
        mode: 'normal',
        completed_at: '2026-07-26T00:00:00Z',
        elapsed_seconds: 120,
        question_answer_details: null,
        quizzes: null
      };

      mockSupabase.maybeSingle.mockResolvedValue({ data: mockRow, error: null });

      const result = await getAttemptDetail('attempt-uuid');
      expect(result.details).toBeNull();
      expect(result.summary.quizTitle).toBe('不明なクイズ');
    });

    test('レコードが存在しない場合エラーをスローすること', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(getAttemptDetail('attempt-uuid')).rejects.toThrow('試行データが見つかりません');
    });
  });

  describe('getCreatorDashboardStats', () => {
    test('get_creator_dashboard_stats RPC を呼び出すこと', async () => {
      const mockResult = { kpi: { plays: 50 } };
      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const filter = {
        period: '30d' as const,
        genreId: 'genre-uuid',
        format: 'multiple-choice',
        visibility: 'public' as const,
      };

      const result = await getCreatorDashboardStats(filter);
      expect(result).toEqual(mockResult);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_creator_dashboard_stats', {
        p_period: '30d',
        p_genre_id: 'genre-uuid',
        p_format: 'multiple-choice',
        p_visibility: 'public',
      });
    });
  });

  describe('getCreatorQuizAnalysis', () => {
    test('get_creator_quiz_analysis RPC を呼び出すこと', async () => {
      const mockResult = { scoreDistribution: [] };
      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null });

      const result = await getCreatorQuizAnalysis('quiz-uuid', '90d');
      expect(result).toEqual(mockResult);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_creator_quiz_analysis', {
        p_quiz_id: 'quiz-uuid',
        p_period: '90d',
      });
    });
  });
});
