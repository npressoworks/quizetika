import { createClient } from '@/lib/supabase/client';
import { 
  PlayerDashboardFilter, 
  PlayerDashboardStats, 
  PlayHistoryPage, 
  PlayHistoryEntry, 
  QuestionAnswerDetail, 
  CreatorDashboardFilter, 
  CreatorDashboardStats, 
  QuizAnalysis 
} from '../types';

const supabase = createClient();

/**
 * プレイヤーダッシュボード統計情報の取得
 */
export async function getPlayerDashboardStats(
  filter: PlayerDashboardFilter
): Promise<PlayerDashboardStats> {
  const { data, error } = await supabase.rpc('get_player_dashboard_stats', {
    p_period: filter.period,
    p_genre_id: filter.genreId || null,
    p_tag: filter.tag || null,
    p_question_type: filter.questionType || null,
    p_mode: filter.mode || null,
  });

  if (error) {
    console.error('[getPlayerDashboardStats] error:', error);
    throw new Error(`統計情報の取得に失敗しました: ${error.message}`);
  }

  return data as PlayerDashboardStats;
}

/**
 * プレイヤー履歴ドリルダウンの取得
 */
export async function getPlayerDrilldownHistory(
  filter: PlayerDashboardFilter,
  cursor?: string,
  limit?: number
): Promise<PlayHistoryPage> {
  const { data, error } = await supabase.rpc('get_player_drilldown_history', {
    p_period: filter.period,
    p_genre_id: filter.genreId || null,
    p_tag: filter.tag || null,
    p_question_type: filter.questionType || null,
    p_mode: filter.mode || null,
    p_cursor: cursor || null,
    p_limit: limit || 20,
  });

  if (error) {
    console.error('[getPlayerDrilldownHistory] error:', error);
    throw new Error(`履歴の取得に失敗しました: ${error.message}`);
  }

  return data as PlayHistoryPage;
}

/**
 * 試行詳細の取得（RLS により本人行のみ取得可能）
 * 明細なし旧試行は details: null
 */
export async function getAttemptDetail(
  attemptId: string
): Promise<{ summary: PlayHistoryEntry; details: QuestionAnswerDetail[] | null }> {
  const { data, error } = await supabase
    .from('attempts')
    .select('*, quizzes(title)')
    .eq('id', attemptId)
    .maybeSingle();

  if (error) {
    console.error('[getAttemptDetail] error:', error);
    throw new Error(`試行詳細の取得に失敗しました: ${error.message}`);
  }

  if (!data) {
    throw new Error('試行データが見つかりません');
  }

  const summary: PlayHistoryEntry = {
    id: data.id,
    quizId: data.quiz_id,
    quizTitle: (data.quizzes as any)?.title || '不明なクイズ',
    score: data.score,
    totalQuestions: data.total_questions,
    mode: data.mode as any,
    completedAt: data.completed_at || '',
    elapsedSeconds: Number(data.elapsed_seconds || 0),
  };

  const detailsRaw = data.question_answer_details;
  let details: QuestionAnswerDetail[] | null = null;
  if (Array.isArray(detailsRaw) && detailsRaw.length > 0) {
    details = detailsRaw as QuestionAnswerDetail[];
  }

  return { summary, details };
}

/**
 * クリエイターダッシュボード統計情報の取得
 */
export async function getCreatorDashboardStats(
  filter: CreatorDashboardFilter
): Promise<CreatorDashboardStats> {
  const { data, error } = await supabase.rpc('get_creator_dashboard_stats', {
    p_period: filter.period,
    p_genre_id: filter.genreId || null,
    p_format: filter.format || null,
    p_visibility: filter.visibility || null,
  });

  if (error) {
    console.error('[getCreatorDashboardStats] error:', error);
    throw new Error(`クリエイター統計情報の取得に失敗しました: ${error.message}`);
  }

  return data as CreatorDashboardStats;
}

/**
 * クリエイター向けクイズ単体分析の取得
 */
export async function getCreatorQuizAnalysis(
  quizId: string,
  period: '7d' | '30d' | '90d' | 'all'
): Promise<QuizAnalysis> {
  const { data, error } = await supabase.rpc('get_creator_quiz_analysis', {
    p_quiz_id: quizId,
    p_period: period,
  });

  if (error) {
    console.error('[getCreatorQuizAnalysis] error:', error);
    throw new Error(`クイズ分析データの取得に失敗しました: ${error.message}`);
  }

  return data as QuizAnalysis;
}
