import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';
import { FeedbackReport } from '../types';
import { canVote } from './review-utils';
import { createNotification } from './notification';

const supabase = createClient();

type FeedbackReportRow = Database['public']['Tables']['feedback_reports']['Row'];

function mapRowToFeedbackReport(row: FeedbackReportRow): FeedbackReport {
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    questionId: row.question_id,
    questionText: row.question_text,
    selectedChoiceText: row.selected_choice_text ?? undefined,
    reporterId: row.reporter_id,
    creatorId: row.creator_id,
    category: row.category as FeedbackReport['category'],
    content: row.content,
    status: row.status as FeedbackReport['status'],
    createdAt: new Date(row.created_at),
  };
}

export interface QuizReview {
  id?: string; // ${reviewerId}_${quizId}
  quizId: string;
  reviewerId: string;
  type: 'positive' | 'negative';
  reason?: string | null;
  createdAt: Date;
}

/* ==========================================================================
   指摘フィードバック送信
   ========================================================================== */

export async function submitFeedbackReport(
  report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'>
): Promise<void> {
  // 事前のEXISTS判定で冪等に振る舞う（部分ユニークインデックス違反を例外として扱わない）
  // question_id が null（クイズ全体への指摘）の場合、PostgRESTの仕様上 .eq() では
  // NULL を正しく照合できないため .is() を使用する
  let existingReportQuery = supabase
    .from('feedback_reports')
    .select('id')
    .eq('quiz_id', report.quizId)
    .eq('reporter_id', report.reporterId)
    .eq('status', 'open');
  existingReportQuery = report.questionId === null
    ? existingReportQuery.is('question_id', null)
    : existingReportQuery.eq('question_id', report.questionId);
  const { data: existingOpenReport } = await existingReportQuery.maybeSingle();

  if (existingOpenReport) {
    // 同一 (quiz_id, question_id, reporter_id) の未解決報告が既にあるため、重複登録しない
    return;
  }

  const { error } = await supabase.from('feedback_reports').insert({
    quiz_id: report.quizId,
    quiz_title: report.quizTitle,
    question_id: report.questionId,
    question_text: report.questionText,
    selected_choice_text: report.selectedChoiceText ?? null,
    reporter_id: report.reporterId,
    creator_id: report.creatorId,
    category: report.category,
    content: report.content,
    status: 'open',
  } as any);

  if (error) {
    throw new Error(`指摘レポートの送信に失敗しました: ${error.message}`);
  }

  // クイズ作成者に間違い指摘が届いたことを通知する
  if (report.reporterId !== report.creatorId) {
    try {
      const { data: sender } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', report.reporterId)
        .maybeSingle();

      const senderName = sender?.display_name ?? 'ユーザー';
      const senderAvatar = sender?.avatar_url ?? '';

      await createNotification({
        userId: report.creatorId,
        type: 'correction_reported',
        senderId: report.reporterId,
        senderName,
        senderAvatar,
        targetId: report.quizId,
        targetTitle: report.quizTitle,
      });
    } catch (err) {
      console.error('指摘送信時の通知作成に失敗しました:', err);
      // 指摘自体の送信は成功しているため、通知作成エラーで全体の処理を失敗させない
    }
  }
}

/** クリエイターダッシュボード用: 未解決（open）の指摘一覧を取得 */
export async function getReportsForCreator(creatorId: string): Promise<FeedbackReport[]> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('status', 'open');

  if (error || !data) return [];
  return data.map(mapRowToFeedbackReport);
}

/**
 * クリエイターダッシュボード用: 作成者に紐づく未解決（open）の指摘を、クイズIDごとに件数集計して返す。
 * `getReportsForCreator` と同一のクエリ条件（creator_id + status: 'open'）を用いるため、
 * 集計対象がずれない。指摘が1件もないクイズはキーに含まれない。
 */
export async function getOpenReportCountsByCreator(
  creatorId: string
): Promise<Record<string, number>> {
  const reports = await getReportsForCreator(creatorId);

  return reports.reduce<Record<string, number>>((counts, report) => {
    counts[report.quizId] = (counts[report.quizId] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * 報告者(reporterId)が特定のクイズ(quizId)に対して送信した、
 * 未解決(status == 'open')の指摘レポート一覧を取得する。
 */
export async function getOpenReportsForQuiz(
  quizId: string,
  reporterId: string
): Promise<FeedbackReport[]> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('reporter_id', reporterId)
    .eq('status', 'open');

  if (error || !data) return [];
  return data.map(mapRowToFeedbackReport);
}

/**
 * 指摘レポートの内容を更新する。
 * RLSの `feedback_reports_update` ポリシーは creator_id のみ許可するため、
 * 報告者本人による編集は `handle_update_feedback_report` RPC（SECURITY DEFINER）で行う。
 */
export async function updateFeedbackReport(
  reportId: string,
  reporterId: string,
  category: 'typo' | 'fact' | 'alternative',
  content: string
): Promise<void> {
  const { error } = await supabase.rpc('handle_update_feedback_report', {
    p_report_id: reportId,
    p_reporter_id: reporterId,
    p_category: category,
    p_content: content,
  });

  if (error) {
    throw new Error(`指摘レポートの更新に失敗しました: ${error.message}`);
  }
}

export async function resolveReport(reportId: string): Promise<void> {
  const { data: reportRow, error: fetchError } = await supabase
    .from('feedback_reports')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (fetchError || !reportRow) {
    throw new Error(`レポートが見つかりません: ${reportId}`);
  }

  const { error: updateError } = await supabase
    .from('feedback_reports')
    .update({ status: 'resolved' })
    .eq('id', reportId);

  if (updateError) {
    throw new Error(`指摘レポートの解決処理に失敗しました: ${updateError.message}`);
  }

  await createNotification({
    userId: reportRow.reporter_id,
    type: 'correction_resolved',
    senderId: 'system',
    senderName: '運営',
    senderAvatar: '',
    targetId: reportRow.quiz_id,
    targetTitle: reportRow.quiz_title,
  });
}

/* ==========================================================================
   良問評価（👍/👎）
   ========================================================================== */

/**
 * 良問/悪問投票を送信する。
 * `handle_submit_review` RPC がアトミックに quiz_reviews のupsertと
 * quizzes.positive_count/negative_count/review_score の差分更新を行う。
 * 同一投票者が同じtypeを再送信した場合はRPC側で無視（no-op）される。
 */
export async function submitReview(
  quizId: string,
  reviewerId: string,
  type: 'positive' | 'negative',
  reason?: string | null
): Promise<void> {
  const { data: quizRow, error: quizError } = await supabase
    .from('quizzes')
    .select('author_id')
    .eq('id', quizId)
    .maybeSingle();

  if (quizError || !quizRow) {
    throw new Error(`クイズが見つかりません: ${quizId}`);
  }

  if (!canVote(reviewerId, quizRow.author_id)) {
    throw new Error('クイズの作成者は評価できません');
  }

  const { error } = await (supabase as any).rpc('handle_submit_review', {
    p_reviewer_id: reviewerId,
    p_quiz_id: quizId,
    p_type: type,
    p_reason: reason ?? null,
  });

  if (error) {
    throw new Error(`レビューの投稿に失敗しました: ${error.message}`);
  }
}

/**
 * ユーザーの良問/悪問投票を取り消す。
 * `handle_retract_review` RPC が quiz_reviews の物理削除と
 * quizzes.positive_count/negative_count/review_score の差分更新をアトミックに行う。
 * 投票が存在しない場合はRPC側で無視（no-op）される。
 */
export async function retractReview(
  quizId: string,
  reviewerId: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_retract_review', {
    p_reviewer_id: reviewerId,
    p_quiz_id: quizId,
  });

  if (error) {
    throw new Error(`レビューの取り消しに失敗しました: ${error.message}`);
  }
}

/**
 * 指定されたクイズIDに関連する未解決（open）の指摘一覧を取得する。
 */
export async function getOpenReportsByQuizId(quizId: string, creatorId: string): Promise<FeedbackReport[]> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .select('*')
    .eq('quiz_id', quizId)
    .eq('creator_id', creatorId)
    .eq('status', 'open');

  if (error || !data) return [];
  return data.map(mapRowToFeedbackReport);
}

/**
 * 指定された指摘レポートを却下（rejected）にする。
 * 却下時は報告者への通知は行わない。
 */
export async function rejectReport(reportId: string): Promise<void> {
  const { data, error } = await supabase
    .from('feedback_reports')
    .update({ status: 'rejected' })
    .eq('id', reportId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    throw new Error(`レポートが見つかりません: ${reportId}`);
  }
}

/**
 * ログインユーザーが指定したクイズに対して行った投票（良問👍/微妙👎）を取得する。
 */
export async function getUserReviewForQuiz(
  quizId: string,
  reviewerId: string
): Promise<'positive' | 'negative' | null> {
  const { data, error } = await supabase
    .from('quiz_reviews')
    .select('type')
    .eq('reviewer_id', reviewerId)
    .eq('quiz_id', quizId)
    .maybeSingle();

  if (error || !data) return null;
  return data.type as 'positive' | 'negative';
}


