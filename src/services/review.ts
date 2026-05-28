/**
 * 指摘フィードバック・良問評価サービス
 *
 * Boundary: ReviewService (Task 2.7)
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  doc,
  addDoc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef } from '../lib/firebase/firestore';
import { FeedbackReport, Quiz } from '../types';
import { calculateReviewScore, getReviewBadge, canVote } from './review-utils';

const feedbackReportsCollection = collection(db, 'feedbackReports');
const notificationsCollection = collection(db, 'notifications');

/* ==========================================================================
   指摘フィードバック送信
   ========================================================================== */

/**
 * クローズドな間違い・別解指摘フィードバックを送信する
 * @param report 指摘レポートデータ（id/status/createdAt を除く）
 * @returns 作成されたレポートのID
 */
export async function submitFeedbackReport(
  report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'>
): Promise<string> {
  const payload: Omit<FeedbackReport, 'id'> = {
    ...report,
    status: 'open',
    createdAt: new Date(),
  };
  const docRef = await addDoc(feedbackReportsCollection, payload);
  return docRef.id;
}

/**
 * 指摘フィードバックを解決済みにし、作成者へのオート通知を送信する
 * @param reportId 解決する指摘のID
 * @param resolverNote 解決メモ（任意）
 */
export async function resolveReport(reportId: string, resolverNote?: string): Promise<void> {
  const reportRef = doc(feedbackReportsCollection, reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) throw new Error(`レポートが見つかりません: ${reportId}`);

  const report = reportSnap.data() as FeedbackReport;

  // レポートを解決済みに更新
  await updateDoc(reportRef, { status: 'resolved' });

  // 指摘者への解決通知を送信
  await addDoc(notificationsCollection, {
    recipientId: report.reporterId,
    type: 'report_resolved',
    quizId: report.quizId,
    quizTitle: report.quizTitle,
    resolverNote: resolverNote ?? null,
    isRead: false,
    createdAt: new Date(),
  });
}

/* ==========================================================================
   良問評価（👍/👎）
   ========================================================================== */

/**
 * 良問/悪問投票を送信し、クイズのカウンタをアトミックに更新する
 * 作成者自身の投票はブロックされる
 *
 * @param quizId 投票対象のクイズID
 * @param voterUid 投票者のUID
 * @param vote 'positive'（👍）または 'negative'（👎）
 */
export async function submitReview(
  quizId: string,
  voterUid: string,
  vote: 'positive' | 'negative'
): Promise<void> {
  const quizDocRef = doc(quizzesRef, quizId);

  await runTransaction(db, async (transaction) => {
    const quizSnap = await transaction.get(quizDocRef);
    if (!quizSnap.exists()) throw new Error(`クイズが見つかりません: ${quizId}`);

    const quiz = quizSnap.data() as Quiz;

    // 作成者は投票不可
    if (!canVote(voterUid, quiz.authorId)) {
      throw new Error('クイズの作成者は評価できません');
    }

    // 仮リセット期間中は temp カウンタに加算
    const isResetPeriod = quiz.isReviewMasked;
    const updates: Record<string, unknown> = {};

    if (isResetPeriod) {
      updates[vote === 'positive' ? 'tempPositiveCount' : 'tempNegativeCount'] = increment(1);
    } else {
      const positiveField = 'positiveCount';
      const negativeField = 'negativeCount';
      updates[vote === 'positive' ? positiveField : negativeField] = increment(1);

      // スコアとバッジを再計算
      const newPositive = quiz.positiveCount + (vote === 'positive' ? 1 : 0);
      const newNegative = quiz.negativeCount + (vote === 'negative' ? 1 : 0);
      const newScore = calculateReviewScore(newPositive, newNegative);
      updates['reviewScore'] = newScore;
      updates['reviewBadge'] = getReviewBadge(newScore);
    }

    transaction.update(quizDocRef, updates);
  });
}

/* ==========================================================================
   評価リセット（非同期バッチ削除）
   ========================================================================== */

/**
 * 評価リセット承認時に過去の quizReviews レコードを100件チャンクで削除する
 * @param quizId リセット対象のクイズID
 */
export async function resetReviews(quizId: string): Promise<void> {
  const reviewsCollection = collection(db, 'quizReviews');
  const q = query(reviewsCollection, where('quizId', '==', quizId));
  const snap = await getDocs(q);

  // 100件チャンクで分割削除（Firestore batch 上限 500件だが安全マージンを確保）
  const CHUNK_SIZE = 100;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // temp カウンタを正式カウンタに昇格し、マスクを解除
  const quizDocRef = doc(quizzesRef, quizId);
  const quizSnap = await getDoc(quizDocRef);
  if (!quizSnap.exists()) return;

  const quiz = quizSnap.data() as Quiz;
  const newPositive = quiz.tempPositiveCount;
  const newNegative = quiz.tempNegativeCount;
  const newScore = calculateReviewScore(newPositive, newNegative);

  await updateDoc(quizDocRef, {
    positiveCount: newPositive,
    negativeCount: newNegative,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: newScore,
    reviewBadge: getReviewBadge(newScore),
    isReviewMasked: false,
    activeResetRequestId: null,
    updatedAt: new Date(),
  });
}
