import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef } from '../lib/firebase/firestore';
import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';
import { FeedbackReport, Quiz } from '../types';
import { calculateReviewScore, getReviewBadge, canVote } from './review-utils';
import { createNotification } from './notification';

const supabase = createClient();

const feedbackReportsCollection = collection(db, 'feedbackReports');
const quizReviewsCollection = collection(db, 'quizReviews');
const reviewResetRequestsCollection = collection(db, 'reviewResetRequests');

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

export interface ReviewResetRequest {
  id?: string;
  quizId: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

/* ==========================================================================
   指摘フィードバック送信
   ========================================================================== */

export async function submitFeedbackReport(
  report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'>
): Promise<void> {
  // 事前のEXISTS判定で冪等に振る舞う（部分ユニークインデックス違反を例外として扱わない）
  const { data: existingOpenReport } = await supabase
    .from('feedback_reports')
    .select('id')
    .eq('quiz_id', report.quizId)
    .eq('question_id', report.questionId)
    .eq('reporter_id', report.reporterId)
    .eq('status', 'open')
    .maybeSingle();

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

/** 作家ダッシュボード用: 未解決（open）の指摘一覧を取得 */
export async function getReportsForCreator(creatorId: string): Promise<FeedbackReport[]> {
  const q = query(
    feedbackReportsCollection,
    where('creatorId', '==', creatorId),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackReport));
}

/**
 * 報告者(reporterId)が特定のクイズ(quizId)に対して送信した、
 * 未解決(status == 'open')の指摘レポート一覧を取得する。
 */
export async function getOpenReportsForQuiz(
  quizId: string,
  reporterId: string
): Promise<FeedbackReport[]> {
  const q = query(
    feedbackReportsCollection,
    where('quizId', '==', quizId),
    where('reporterId', '==', reporterId),
    where('status', '==', 'open')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedbackReport));
}

/**
 * 指摘レポートの内容を更新する。
 */
export async function updateFeedbackReport(
  reportId: string,
  category: 'typo' | 'fact' | 'alternative',
  content: string
): Promise<void> {
  const reportRef = doc(feedbackReportsCollection, reportId);
  await updateDoc(reportRef, {
    category,
    content,
    updatedAt: new Date(),
  });
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
 * 指定クイズの良問率・良問数・悪問数・バッジ指定を取得。
 * 仮リセット期間中の場合は temp カウンタを返し、過去の評価をマスクする。
 */
export async function getReviewStats(
  quizId: string
): Promise<{
  reviewScore: number | null;
  positiveCount: number;
  negativeCount: number;
  reviewBadge: string | null;
  tempPositiveCount?: number;
  tempNegativeCount?: number;
}> {
  const quizDocRef = doc(quizzesRef, quizId);
  const snap = await getDoc(quizDocRef);

  if (!snap.exists()) {
    return {
      reviewScore: null,
      positiveCount: 0,
      negativeCount: 0,
      reviewBadge: null,
    };
  }

  const quiz = snap.data() as Quiz;

  if (quiz.isReviewMasked) {
    // マスク期間中: temp を正規カウンタとみなして表示し、過去の評価をマスク
    const score = calculateReviewScore(quiz.tempPositiveCount, quiz.tempNegativeCount);
    return {
      reviewScore: score,
      positiveCount: quiz.tempPositiveCount,
      negativeCount: quiz.tempNegativeCount,
      reviewBadge: getReviewBadge(score),
      tempPositiveCount: quiz.tempPositiveCount,
      tempNegativeCount: quiz.tempNegativeCount,
    };
  }

  return {
    reviewScore: quiz.reviewScore ?? null,
    positiveCount: quiz.positiveCount ?? 0,
    negativeCount: quiz.negativeCount ?? 0,
    reviewBadge: quiz.reviewBadge ?? null,
  };
}

/* ==========================================================================
   評価リセット申請
   ========================================================================== */

/**
 * 「要改善」バッジのクイズの評価リセット申請を登録し、仮リセット期間（マスク）に入る
 */
export async function submitReviewResetRequest(
  quizId: string,
  requesterId: string
): Promise<string> {
  const quizDocRef = doc(quizzesRef, quizId);

  return await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);
    const quiz = quizSnap.data() as Quiz;

    if (quiz.authorId !== requesterId) {
      throw new Error('クイズの作成者のみがリセット申請を起案できます。');
    }

    const now = new Date();
    const requestPayload: Omit<ReviewResetRequest, 'id'> = {
      quizId,
      requesterId,
      status: 'pending',
      createdAt: now,
    };

    const newReqRef = doc(reviewResetRequestsCollection);
    transaction.set(newReqRef, requestPayload);

    // クイズを仮リセット期間に移行
    transaction.update(quizDocRef, {
      isReviewMasked: true,
      activeResetRequestId: newReqRef.id,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      updatedAt: Timestamp.fromDate(now),
    });

    return newReqRef.id;
  });
}

/**
 * 評価リセット承認時に過去の quizReviews レコードを100件チャンクで物理削除する。
 * その後、tempカウンターの値を正規カウンターに昇格しマスクを解除する。
 */
export async function resetReviews(quizId: string): Promise<void> {
  const q = query(quizReviewsCollection, where('quizId', '==', quizId));
  let hasMore = true;
  const CHUNK_SIZE = 100;

  try {
    while (hasMore) {
      const snap = await getDocs(query(q, limit(CHUNK_SIZE)));
      if (snap.empty) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      if (snap.docs.length < CHUNK_SIZE) {
        hasMore = false;
      }
    }

    // temp カウンタを正式カウンタに昇格し、マスクを解除
    const quizDocRef = doc(quizzesRef, quizId);
    await runTransaction(db, async (transaction) => {
      const quizSnap = await transaction.get(quizDocRef);
      if (!quizSnap.exists()) return;

      const quiz = quizSnap.data() as Quiz;
      const newPositive = quiz.tempPositiveCount ?? 0;
      const newNegative = quiz.tempNegativeCount ?? 0;
      const newScore = calculateReviewScore(newPositive, newNegative);

      transaction.update(quizDocRef, {
        positiveCount: newPositive,
        negativeCount: newNegative,
        tempPositiveCount: 0,
        tempNegativeCount: 0,
        reviewScore: newScore,
        reviewBadge: getReviewBadge(newScore),
        isReviewMasked: false,
        activeResetRequestId: null,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    });
  } catch (err) {
    console.error('[ReviewReset] リセット過去データ削除エラー:', err);
    throw err;
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


